-- Milestone 5: private admin notes on bookings
--
-- Nothing in the schema currently has anywhere to store staff notes about a
-- booking. This adds one nullable column — not a redesign of anything
-- existing. It's covered by the same RLS policies already on this table
-- ("Admins read all bookings" / "Admins update bookings"), so it inherits
-- the correct "staff only, never guest-visible" access automatically.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS admin_notes TEXT;
