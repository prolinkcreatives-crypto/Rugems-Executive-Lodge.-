-- Fix broken room images.
--
-- hero_image/gallery previously pointed at Lovable-internal upload paths
-- (/__l5e/assets-v1/<uuid>/room-*.png) set by migration
-- 20260718094221_16ef5e8e-8bbf-4345-a208-3df891c0174d.sql. Those paths only
-- resolve inside Lovable's own hosting and 404 on the independently
-- deployed Cloudflare Pages site. The real photos now ship as static files
-- in public/ (room-king.webp, room-queen.webp, room-double.webp), so point
-- the columns at those root-relative paths instead.

UPDATE public.sanctuaries
SET hero_image = '/room-king.webp',
    gallery = ARRAY['/room-king.webp']
WHERE slug = 'king-suite';

UPDATE public.sanctuaries
SET hero_image = '/room-queen.webp',
    gallery = ARRAY['/room-queen.webp']
WHERE slug = 'queen-suite';

UPDATE public.sanctuaries
SET hero_image = '/room-double.webp',
    gallery = ARRAY['/room-double.webp']
WHERE slug = 'double-ensuite';
