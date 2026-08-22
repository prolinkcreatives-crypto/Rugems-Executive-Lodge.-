-- Tracks whether the new-booking staff notification has been sent, keyed by
-- the booking's own id. Nullable: NULL = not yet notified. Set once, right
-- after a successful OquMail send, guarded by `WHERE notified_at IS NULL`
-- so a retry of that update can never re-fire a notification for the same
-- row (see createBooking in src/lib/atelier.functions.ts).
ALTER TABLE public.bookings ADD COLUMN notified_at TIMESTAMPTZ;
