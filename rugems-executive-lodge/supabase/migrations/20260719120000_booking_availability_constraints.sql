-- Milestone 1: Booking availability engine
--
-- createBooking previously inserted rows with no conflict check at all, so
-- two guests could hold the same room at the same branch for overlapping
-- dates. This migration enforces that at the data layer, which is the only
-- place it can be enforced atomically (the application layer can't prevent
-- two simultaneous requests from both passing a "is it free?" read).

-- btree_gist lets a GiST index enforce plain equality (=) on text columns
-- alongside range-overlap (&&) on a daterange in the same exclusion
-- constraint below. Without it, only the range operators would be available.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Defense in depth: the booking wizard already prevents check_out <= check_in
-- client-side, and the server function validates it too (see
-- src/lib/atelier.functions.ts), but this guarantees it can never happen no
-- matter what writes the row.
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_check_out_after_check_in
  CHECK (check_out > check_in);

-- The double-booking guard itself: for the same room (sanctuary_slug) at the
-- same branch (location), no two non-cancelled bookings may have overlapping
-- [check_in, check_out) date ranges — i.e. a checkout day is free for
-- someone else's check-in that same day.
--
-- location is nullable in the schema even though the app always sets it, so
-- it's wrapped in COALESCE(location, '') here — otherwise two NULL-location
-- rows would never be considered a conflict (NULL is never "equal" to NULL
-- for this kind of check) and the guard would silently do nothing for them.
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_no_overlapping_dates
  EXCLUDE USING gist (
    sanctuary_slug WITH =,
    (COALESCE(location, '')) WITH =,
    (daterange(check_in, check_out, '[)')) WITH &&
  )
  WHERE (status <> 'cancelled');
