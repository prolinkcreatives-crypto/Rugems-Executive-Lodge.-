-- Admin room management, Phase 1: price editing (no schema change needed —
-- sanctuaries.price_per_night already exists) and image management.
--
-- Public bucket: reads happen over the plain public-object URL, which
-- Supabase serves with no RLS check involved — that's what `public: true`
-- means. Only insert/update/delete are policy-gated, mirroring the same
-- has_role(auth.uid(), 'admin') check already used throughout this project
-- (see the "Admins manage sanctuaries" policy from the first migration).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('room-images', 'room-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Admins upload room images" on storage.objects for insert to authenticated
  with check (bucket_id = 'room-images' and public.has_role(auth.uid(), 'admin'));
create policy "Admins update room images" on storage.objects for update to authenticated
  using (bucket_id = 'room-images' and public.has_role(auth.uid(), 'admin'));
create policy "Admins delete room images" on storage.objects for delete to authenticated
  using (bucket_id = 'room-images' and public.has_role(auth.uid(), 'admin'));
