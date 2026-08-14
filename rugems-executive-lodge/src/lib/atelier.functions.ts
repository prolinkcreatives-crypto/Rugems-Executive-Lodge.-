import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sendOquMailEmail } from "@/lib/oqumail.server";

const ADMIN_URL = "https://rugemsexecutivelodge.net/admin";
// Phase 2 only: recipient (bookings@) + CC (info@) per spec. OquMail's
// confirmed fields don't include a distinct `cc` — see oqumail.server.ts —
// so both addresses go in `to` for now; genuine CC semantics can be added
// once that's verified against the account's real API reference.
const NOTIFICATION_RECIPIENTS = ["bookings@rugemsexecutivelodge.net", "info@rugemsexecutivelodge.net"];

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending_payment: "Pending Payment",
  payment_submitted: "Payment Submitted",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

/**
 * Plain-text notification body. Phase 3 will replace this with a styled
 * HTML version — kept deliberately simple here since Phase 1/2 is about
 * the pipeline working correctly, not the final design, and OquMail's
 * confirmed API fields only show `text` (see oqumail.server.ts).
 */
function buildBookingNotificationText(input: {
  reference: string;
  guestName: string;
  phone: string | null;
  sanctuaryName: string;
  location: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalAmount: number;
  specialRequests: string | null;
}): string {
  const createdAt = new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return [
    `Booking reference: ${input.reference}`,
    `Guest: ${input.guestName}`,
    `Phone: ${input.phone ?? "Not provided"}`,
    `Room: ${input.sanctuaryName} (${input.location})`,
    `Check-in: ${input.checkIn}`,
    `Check-out: ${input.checkOut}`,
    `Guests: ${input.guests}`,
    `Total amount: K${input.totalAmount.toLocaleString()}`,
    `Payment status: ${PAYMENT_STATUS_LABEL.pending_payment}`,
    `Special requests: ${input.specialRequests ?? "None"}`,
    `Booked: ${createdAt}`,
    "",
    `View booking: ${ADMIN_URL}`,
  ].join("\n");
}

function serverPublic() {
  const SUPABASE_URL =
    import.meta.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing Supabase environment variables."
    );
  }

  return createClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

export const listSanctuaries = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await serverPublic()
    .from("sanctuaries")
    .select("slug,name,tagline,location,description,price_per_night,size_sqm,amenities,hero_image,gallery,sort_order")
    .eq("active", true)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getSanctuary = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await serverPublic()
      .from("sanctuaries")
      .select("slug,name,tagline,location,description,price_per_night,size_sqm,amenities,hero_image,gallery")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

const locationSlugSchema = z.enum(["new-avondale", "ranchdale"]);

const bookingSchema = z
  .object({
    sanctuarySlug: z.string().min(1),
    guestName: z.string().min(2).max(120),
    email: z.string().email(),
    phone: z.string().max(40).optional(),
    checkIn: z.string(), // ISO date
    checkOut: z.string(),
    guests: z.number().int().min(1).max(12),
    specialRequests: z.string().max(1000).optional(),
    location: locationSlugSchema,
  })
  .refine((v) => new Date(v.checkOut) > new Date(v.checkIn), {
    message: "Check-out date must be after check-in date.",
    path: ["checkOut"],
  });

/**
 * Thrown by createBooking when the `bookings_no_overlapping_dates` exclusion
 * constraint rejects an insert (see the Milestone 1 migration). Prefixing
 * the message lets the client tell a genuine availability conflict apart
 * from any other failure — thrown Errors cross the server-fn boundary as a
 * plain message string, so a sentinel prefix is the most reliable signal
 * available without inventing a custom error type.
 */
const AVAILABILITY_CONFLICT_PREFIX = "AVAILABILITY_CONFLICT::";

export function isAvailabilityConflictError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith(AVAILABILITY_CONFLICT_PREFIX);
}

export function availabilityConflictMessage(error: unknown): string {
  if (error instanceof Error && error.message.startsWith(AVAILABILITY_CONFLICT_PREFIX)) {
    return error.message.slice(AVAILABILITY_CONFLICT_PREFIX.length);
  }
  return error instanceof Error ? error.message : "Something went wrong";
}

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((input) => bookingSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Look up sanctuary to compute price / capture name
    const { data: sanctuary, error: sErr } = await supabaseAdmin
      .from("sanctuaries")
      .select("name, price_per_night")
      .eq("slug", data.sanctuarySlug)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!sanctuary) throw new Error("Sanctuary not found");

    const nights = Math.max(
      1,
      Math.round(
        (new Date(data.checkOut).getTime() - new Date(data.checkIn).getTime()) / 86_400_000,
      ),
    );
    const total = sanctuary.price_per_night * nights;

    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .insert({
        sanctuary_slug: data.sanctuarySlug,
        sanctuary_name: sanctuary.name,
        guest_name: data.guestName,
        email: data.email,
        phone: data.phone ?? null,
        check_in: data.checkIn,
        check_out: data.checkOut,
        guests: data.guests,
        special_requests: data.specialRequests ?? null,
        total_amount: total,
        location: data.location,
      })
      .select("id, reference, total_amount, sanctuary_name, check_in, check_out, location")
      .single();

    if (error) {
      // 23P01 = exclusion_violation → bookings_no_overlapping_dates fired,
      // meaning another hold already covers these dates for this room.
      if (error.code === "23P01") {
        throw new Error(
          `${AVAILABILITY_CONFLICT_PREFIX}Those dates are no longer available for this room at this location. Please choose different dates or another room.`,
        );
      }
      // 23514 = check_violation → bookings_check_out_after_check_in fired.
      // The Zod refine above already blocks this from the normal wizard;
      // this only matters for calls that bypass client-side validation.
      if (error.code === "23514") {
        throw new Error("Check-out date must be after check-in date.");
      }
      throw new Error(error.message);
    }

    // Booking is now the source of truth — everything from here on is
    // best-effort and must never change the outcome the guest sees, so the
    // whole block is guarded: even an unexpected throw here (e.g. the
    // notified_at update itself failing) can't turn into a failed booking.
    // `notified_at IS NULL` makes the update — and therefore the ability to
    // send again — a one-shot per booking id, so an accidental second call
    // for the same row can't double-send.
    try {
      const notifyResult = await sendOquMailEmail({
        to: NOTIFICATION_RECIPIENTS,
        fromName: "Rugems Executive Lodge",
        subject: "🔴 NEW BOOKING — ACTION REQUIRED | Rugems Executive Lodge",
        text: buildBookingNotificationText({
          reference: booking.reference,
          guestName: data.guestName,
          phone: data.phone ?? null,
          sanctuaryName: booking.sanctuary_name,
          location: booking.location,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          guests: data.guests,
          totalAmount: booking.total_amount,
          specialRequests: data.specialRequests ?? null,
        }),
      });

      if (notifyResult.ok) {
        await supabaseAdmin
          .from("bookings")
          .update({ notified_at: new Date().toISOString() })
          .eq("id", booking.id)
          .is("notified_at", null);
      } else {
        // Logged, not thrown — the booking already succeeded and must stay
        // that way regardless of email outcome.
        console.error(`[booking] notification failed for ${booking.reference}: ${notifyResult.error}`);
      }
    } catch (notifyErr) {
      console.error(
        `[booking] notification step threw for ${booking.reference}:`,
        notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
      );
    }

    return { ...booking, nights };
  });

/**
 * Lightweight, non-authoritative availability check intended for live UI
 * feedback (e.g. while a guest is still picking dates, before they reach
 * "Hold Reservation"). The `bookings_no_overlapping_dates` exclusion
 * constraint remains the single source of truth — the actual guarantee
 * createBooking's insert relies on — so a conflict slipping past this check
 * can never corrupt data; the guest would just see createBooking's friendly
 * error one step later instead of catching it here first. Not yet wired
 * into the booking wizard's UI — that's planned for Milestone 2.
 */
const availabilityInputSchema = z
  .object({
    sanctuarySlug: z.string().min(1),
    location: locationSlugSchema,
    checkIn: z.string(),
    checkOut: z.string(),
  })
  .refine((v) => new Date(v.checkOut) > new Date(v.checkIn), {
    message: "Check-out date must be after check-in date.",
    path: ["checkOut"],
  });

export const checkAvailability = createServerFn({ method: "GET" })
  .inputValidator((input) => availabilityInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("sanctuary_slug", data.sanctuarySlug)
      .eq("location", data.location)
      .neq("status", "cancelled")
      .lt("check_in", data.checkOut)
      .gt("check_out", data.checkIn);
    if (error) throw new Error(error.message);
    return { available: (count ?? 0) === 0 };
  });

export const submitPayment = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        reference: z.string().min(4),
        paymentReference: z.string().min(2).max(120),
        proofBase64: z.string().min(50), // data URL string, capped to keep this simple
        proofFileName: z.string().max(120),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // decode data URL
    const match = /^data:(.+?);base64,(.+)$/.exec(data.proofBase64);
    if (!match) throw new Error("Invalid proof upload");
    const contentType = match[1];
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > 5 * 1024 * 1024) throw new Error("Proof must be under 5 MB");

    const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new Error("Please upload a JPG, PNG, or WEBP image.");
    }

    // Verify the booking still exists and is still pending_payment BEFORE
    // touching Storage. This is what prevents an orphaned file: if this
    // check fails, we return immediately and no upload is ever attempted.
    const { data: existing, error: lookupErr } = await supabaseAdmin
      .from("bookings")
      .select("status")
      .eq("reference", data.reference)
      .maybeSingle();
    if (lookupErr) throw new Error(lookupErr.message);
    if (!existing || existing.status !== "pending_payment") {
      throw new Error(
        "This booking couldn't be updated — it may no longer exist or may already be past the payment step.",
      );
    }

    const safeName = data.proofFileName.replace(/[^a-z0-9._-]/gi, "_");
    const path = `${data.reference}/${Date.now()}-${safeName}`;
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("payment-proofs")
      .upload(path, bytes, { contentType, upsert: false });
    if (uploadErr) throw new Error(uploadErr.message);

    // Still guarded by status here too — this closes the narrow race window
    // between the pre-check above and this update (e.g. two genuinely
    // concurrent submissions for the same booking). The pre-check handles
    // the realistic case (a stale tab or revisited link); this remains the
    // atomic, authoritative guarantee for the rare case it doesn't.
    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .update({
        payment_reference: data.paymentReference,
        proof_url: path,
        status: "payment_submitted",
      })
      .eq("reference", data.reference)
      .eq("status", "pending_payment")
      .select("reference, sanctuary_name, guest_name, total_amount, check_in, check_out")
      .single();

    if (error) {
      // PGRST116 = no row matched .single()'s expectation of exactly one —
      // this reference doesn't exist, or isn't pending_payment anymore.
      if (error.code === "PGRST116") {
        throw new Error(
          "This booking couldn't be updated — it may no longer exist or may already be past the payment step.",
        );
      }
      throw new Error(error.message);
    }
    return booking;
  });

export const getBookingByReference = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ reference: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("bookings")
      .select("reference, sanctuary_name, guest_name, email, total_amount, check_in, check_out, status, location")
      .eq("reference", data.reference)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });
