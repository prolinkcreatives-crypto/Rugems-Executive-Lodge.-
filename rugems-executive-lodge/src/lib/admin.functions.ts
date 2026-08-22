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

// ---------------------------------------------------------------------
// Room management (Phase 1: price + images only — see the admin plan for
// what's deliberately out of scope here: no capacity, status, or
// per-branch inventory).
// ---------------------------------------------------------------------

const ROOM_IMAGE_BUCKET = "room-images";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * If a stored image URL points into the room-images bucket, returns the
 * object path within it so it can be deleted. Returns null for anything
 * else (in particular, the pre-existing `public/`-relative paths like
 * "/room-king.webp") — those aren't Storage objects, so there's nothing to
 * delete, and this lets old and new images coexist without either code
 * path needing to know which kind of reference it's looking at.
 */
function roomImageStoragePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${ROOM_IMAGE_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

export const updateSanctuaryPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        slug: z.string().min(1),
        pricePerNight: z.number().int().positive().max(100_000),
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
    const { data: updated, error } = await supabaseAdmin
      .from("sanctuaries")
      .update({ price_per_night: data.pricePerNight })
      .eq("slug", data.slug)
      .select("slug")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Room not found.");
    return { ok: true };
  });

export const uploadSanctuaryImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        slug: z.string().min(1),
        imageBase64: z.string().min(50), // data URL string
        fileName: z.string().max(120),
        target: z.enum(["hero", "gallery"]),
        // Set when replacing a specific existing gallery image in place
        // (its array position is preserved) rather than adding a new one.
        replaceUrl: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const match = /^data:(.+?);base64,(.+)$/.exec(data.imageBase64);
    if (!match) throw new Error("Invalid image upload");
    const contentType = match[1];
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error("Image must be under 5 MB");
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) throw new Error("Please upload a JPG, PNG, or WEBP image.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sanctuary, error: lookupErr } = await supabaseAdmin
      .from("sanctuaries")
      .select("hero_image, gallery")
      .eq("slug", data.slug)
      .maybeSingle();
    if (lookupErr) throw new Error(lookupErr.message);
    if (!sanctuary) throw new Error("Room not found.");

    // Upload the new image first — if this fails, nothing about the room
    // has changed yet, so there's no partial/broken state to clean up.
    const safeName = data.fileName.replace(/[^a-z0-9._-]/gi, "_");
    const path = `${data.slug}/${Date.now()}-${safeName}`;
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(ROOM_IMAGE_BUCKET)
      .upload(path, bytes, { contentType, upsert: false });
    if (uploadErr) throw new Error(uploadErr.message);

    const { data: pub } = supabaseAdmin.storage.from(ROOM_IMAGE_BUCKET).getPublicUrl(path);
    const newUrl = pub.publicUrl;

    let previousUrl: string | null = null;
    let updatePayload: { hero_image?: string; gallery?: string[] };

    if (data.target === "hero") {
      previousUrl = sanctuary.hero_image;
      updatePayload = { hero_image: newUrl };
    } else {
      const gallery = sanctuary.gallery ?? [];
      if (data.replaceUrl) {
        const idx = gallery.indexOf(data.replaceUrl);
        if (idx === -1) {
          // The image being replaced is already gone from this room — add
          // the upload as new rather than silently discarding it.
          updatePayload = { gallery: [...gallery, newUrl] };
        } else {
          previousUrl = data.replaceUrl;
          const next = [...gallery];
          next[idx] = newUrl;
          updatePayload = { gallery: next };
        }
      } else {
        updatePayload = { gallery: [...gallery, newUrl] };
      }
    }

    // Only now — after the new file is safely stored — does the room
    // record change. If this update fails, the new upload is orphaned
    // (safe: nothing references it) rather than the room ending up with a
    // broken or missing reference.
    const { error: updateErr } = await supabaseAdmin.from("sanctuaries").update(updatePayload).eq("slug", data.slug);
    if (updateErr) {
      throw new Error(
        `Image uploaded, but the room record wasn't updated (${updateErr.message}). Nothing on the site changed — try again.`,
      );
    }

    // Best-effort cleanup of the file this one replaced. Not fatal if it
    // fails (and a no-op for pre-existing public/-folder paths, which
    // aren't Storage objects) — the room's reference is already correct
    // and saved by this point regardless of what happens here.
    const oldPath = roomImageStoragePath(previousUrl);
    if (oldPath) {
      await supabaseAdmin.storage.from(ROOM_IMAGE_BUCKET).remove([oldPath]).catch(() => {});
    }

    return { ok: true, url: newUrl };
  });

export const uploadSiteImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        slotKey: z.string().min(1),
        imageBase64: z.string().min(50),
        fileName: z.string().max(120),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const match = /^data:(.+?);base64,(.+)$/.exec(data.imageBase64);
    if (!match) throw new Error("Invalid image upload");
    const contentType = match[1];
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error("Image must be under 5 MB");
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) throw new Error("Please upload a JPG, PNG, or WEBP image.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Current value, if any, so the old file can be cleaned up after the
    // new one is safely referenced — same ordering as room images.
    const { data: existing } = await supabaseAdmin
      .from("site_images")
      .select("url")
      .eq("slot_key", data.slotKey)
      .maybeSingle();

    const safeName = data.fileName.replace(/[^a-z0-9._-]/gi, "_");
    const path = `${data.slotKey}/${Date.now()}-${safeName}`;
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("site-images")
      .upload(path, bytes, { contentType, upsert: false });
    if (uploadErr) throw new Error(uploadErr.message);

    const { data: pub } = supabaseAdmin.storage.from("site-images").getPublicUrl(path);
    const newUrl = pub.publicUrl;

    // Only now does the slot's reference change. The CHECK constraint on
    // slot_key rejects anything outside the fixed inventory — this can
    // only ever replace one of the sixteen existing slots, never create a
    // new one.
    const { error: upsertErr } = await supabaseAdmin
      .from("site_images")
      .upsert({ slot_key: data.slotKey, url: newUrl, updated_at: new Date().toISOString() });
    if (upsertErr) {
      throw new Error(
        `Image uploaded, but the site record wasn't updated (${upsertErr.message}). Nothing on the site changed — try again.`,
      );
    }

    // Best-effort cleanup of the file this replaced, if it was itself a
    // site-images-bucket file (not the original public/-folder asset —
    // nothing to delete there, and this correctly skips it).
    const marker = "/storage/v1/object/public/site-images/";
    const oldUrl = existing?.url;
    const oldIdx = oldUrl ? oldUrl.indexOf(marker) : -1;
    if (oldUrl && oldIdx !== -1) {
      const oldPath = oldUrl.slice(oldIdx + marker.length);
      await supabaseAdmin.storage.from("site-images").remove([oldPath]).catch(() => {});
    }

    return { ok: true, url: newUrl };
  });

export const deleteSanctuaryImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ slug: z.string().min(1), imageUrl: z.string().min(1) }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sanctuary, error: lookupErr } = await supabaseAdmin
      .from("sanctuaries")
      .select("hero_image, gallery")
      .eq("slug", data.slug)
      .maybeSingle();
    if (lookupErr) throw new Error(lookupErr.message);
    if (!sanctuary) throw new Error("Room not found.");

    // Gallery images only — the featured image can be replaced but never
    // deleted outright, so a room can never end up with no usable
    // featured image. Enforced here server-side, not just by which
    // buttons the UI happens to show.
    if (data.imageUrl === sanctuary.hero_image) {
      throw new Error("The featured image can't be deleted directly — replace it with a new one instead.");
    }
    const gallery = sanctuary.gallery ?? [];
    if (!gallery.includes(data.imageUrl)) throw new Error("That image isn't part of this room's gallery.");

    const { error: updateErr } = await supabaseAdmin
      .from("sanctuaries")
      .update({ gallery: gallery.filter((u) => u !== data.imageUrl) })
      .eq("slug", data.slug);
    if (updateErr) throw new Error(updateErr.message);

    const path = roomImageStoragePath(data.imageUrl);
    if (path) {
      await supabaseAdmin.storage.from(ROOM_IMAGE_BUCKET).remove([path]).catch(() => {});
    }
    return { ok: true };
  });
