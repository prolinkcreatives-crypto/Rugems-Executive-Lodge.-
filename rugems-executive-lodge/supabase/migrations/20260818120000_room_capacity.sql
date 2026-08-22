-- Room capacity. Confirmed via fresh inspection (grep across every prior
-- migration and every relevant source file) that this was never actually
-- implemented — the 3->6 inventory plan that would have introduced it was
-- explicitly stopped and reverted before any migration for it was written.
--
-- King Suite: 4 (has an additional double bed per the brief)
-- Queen Suite: 2
-- Double Ensuite: 2

ALTER TABLE public.sanctuaries ADD COLUMN capacity INTEGER;

UPDATE public.sanctuaries SET capacity = 4 WHERE slug = 'king-suite';
UPDATE public.sanctuaries SET capacity = 2 WHERE slug = 'queen-suite';
UPDATE public.sanctuaries SET capacity = 2 WHERE slug = 'double-ensuite';

ALTER TABLE public.sanctuaries ALTER COLUMN capacity SET NOT NULL;
ALTER TABLE public.sanctuaries ADD CONSTRAINT sanctuaries_capacity_positive CHECK (capacity >= 1);
