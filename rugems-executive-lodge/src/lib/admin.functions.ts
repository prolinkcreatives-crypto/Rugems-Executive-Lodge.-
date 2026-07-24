import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const bookingStatusSchema = z.enum([
  "pending_payment",
  "payment_submitted",
  "confirmed",
  "cancelled",
]);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

// Single source of truth for which status changes make business sense —
// imported by the admin dashboard too, so the UI never even offers a
// transition this function would reject. Cancelled is intentionally
// terminal: un-cancelling could silently conflict with another booking
// that was made for the same room/dates after this one freed them up
// (see the Milestone 1 availability constraint).
export const ALLOWED_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending_payment: ["payment_submitted", "cancelled"],
  payment_submitted: ["confirmed", "cancelled", "pending_payment"],
  confirmed: ["cancelled"],
  cancelled: [],
};

export const listAllBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Signed URLs only — the raw storage path (proof_url) is dropped from
    // every returned row rather than forwarded unused, so nothing beyond
    // the short-lived, scoped signed URL ever leaves the server.
    const enriched = await Promise.all(
      (data ?? []).map(async ({ proof_url, ...rest }) => {
        if (!proof_url) return { ...rest, proof_signed_url: null as string | null };
        const { data: signed } = await supabaseAdmin.storage
          .from("payment-proofs")
          .createSignedUrl(proof_url, 60 * 30);
        return { ...rest, proof_signed_url: signed?.signedUrl ?? null };
      }),
    );
    return enriched;
  });

export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        status: bookingStatusSchema,
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Every status a legal move to data.status could start from, plus
    // data.status itself (a same-status write is a harmless no-op). This
    // set is baked into the UPDATE's own WHERE clause below, so the
    // "is this transition allowed" check and the write happen as one
    // atomic statement — there's no separate read-then-write gap for a
    // second concurrent request to land in between.
    const allowedFromStatuses = bookingStatusSchema.options.filter(
      (from) => from === data.status || ALLOWED_STATUS_TRANSITIONS[from].includes(data.status),
    );

    const { data: updated, error } = await supabaseAdmin
      .from("bookings")
      .update({ status: data.status })
      .eq("id", data.id)
      .in("status", allowedFromStatuses)
      .select("status")
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!updated) {
      // The update above matched nothing — either the booking doesn't
      // exist, or its current status isn't an allowed starting point.
      // This follow-up read is only to build a precise error message; it
      // can't reopen the race, since the atomic update has already
      // failed to apply by this point regardless of what this finds.
      const { data: current } = await supabaseAdmin.from("bookings").select("status").eq("id", data.id).maybeSingle();
      if (!current) throw new Error("Booking not found.");
      throw new Error(
        `Can't move a booking from "${current.status.replace("_", " ")}" to "${data.status.replace("_", " ")}".`,
      );
    }
    return { ok: true };
  });

export const updateBookingNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        notes: z.string().max(5000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("bookings").update({ admin_notes: data.notes }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const currentUserIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: Boolean(data) };
  });
