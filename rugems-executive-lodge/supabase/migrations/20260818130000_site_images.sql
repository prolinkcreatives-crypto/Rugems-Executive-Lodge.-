-- Website-wide image replacement (non-room images).
--
-- A fixed, enumerated set of slots — not a general media library. slot_key
-- is constrained to exactly the image positions actually found in the
-- codebase (see the CHECK constraint), so this can only ever replace an
-- existing image, never create a new arbitrary one.
--
-- A missing row (or NULL url) for a slot means "use the original
-- hardcoded/static image" — every current image keeps working exactly as
-- it does today until an admin explicitly replaces it.
CREATE TABLE public.site_images (
  slot_key TEXT PRIMARY KEY CHECK (slot_key IN (
    'homepage-hero', 'homepage-reception', 'homepage-suite-preview',
    'location-new-avondale', 'location-ranchdale',
    'story-hero', 'story-wood-detail', 'story-corridor', 'story-artisan-hands', 'story-textiles',
    'experiences-hero', 'experiences-bath', 'experiences-reading-nook',
    'experiences-dining', 'experiences-pool', 'experiences-candle'
  )),
  url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read site images" ON public.site_images FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage site images" ON public.site_images FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT ALL ON public.site_images TO service_role;

-- Same pattern as room-images: public read (no policy needed — that's how
-- a public bucket serves objects), admin-only write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-images', 'site-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Admins upload site images" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-images' and public.has_role(auth.uid(), 'admin'));
create policy "Admins update site images" on storage.objects for update to authenticated
  using (bucket_id = 'site-images' and public.has_role(auth.uid(), 'admin'));
create policy "Admins delete site images" on storage.objects for delete to authenticated
  using (bucket_id = 'site-images' and public.has_role(auth.uid(), 'admin'));
