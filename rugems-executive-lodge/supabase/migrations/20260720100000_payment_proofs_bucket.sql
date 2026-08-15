-- Milestone 4: payment-proofs storage bucket
--
-- submitPayment (src/lib/atelier.functions.ts) and getProofUrl
-- (src/lib/admin.functions.ts) have referenced a "payment-proofs" bucket
-- since before Milestone 1, but no migration in this repo ever created it —
-- it either exists only because someone created it by hand in the
-- Supabase/Lovable Cloud dashboard, or every upload has been silently
-- failing. This makes it reproducible, and adds bucket-level size/type
-- guardrails that mirror the application-level checks in submitPayment.
--
-- No RLS policies are added on storage.objects for this bucket: RLS is
-- enabled by default on that table, and every read/write already goes
-- through the service-role client (supabaseAdmin) in submitPayment and
-- getProofUrl. Adding no policy is what keeps it private from anon/
-- authenticated roles — that's the intended, correct posture, not a gap.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880, -- 5 MB, matching submitPayment's existing size check
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
