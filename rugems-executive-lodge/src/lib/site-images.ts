import { createServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { serverPublic } from "@/lib/atelier.functions";

/**
 * Fixed, enumerated inventory of every existing website image slot found
 * by inspecting the codebase — not a general media library. An admin can
 * only replace one of these; there's no path to creating a new one.
 * Mirrors the CHECK constraint on site_images.slot_key.
 */
export const SITE_IMAGE_SLOTS = [
  { key: "homepage-hero", section: "Homepage", label: "Hero Image" },
  { key: "homepage-reception", section: "Homepage", label: "Reception Image" },
  { key: "homepage-suite-preview", section: "Homepage", label: "Suite Preview Image" },
  { key: "location-new-avondale", section: "Locations", label: "New Avondale" },
  { key: "location-ranchdale", section: "Locations", label: "Ranchdale" },
  { key: "story-hero", section: "Story", label: "Hero Image" },
  { key: "story-wood-detail", section: "Story", label: "Wood Detail" },
  { key: "story-corridor", section: "Story", label: "Corridor" },
  { key: "story-artisan-hands", section: "Story", label: "Artisan Hands" },
  { key: "story-textiles", section: "Story", label: "Textiles" },
  { key: "experiences-hero", section: "Experiences", label: "Hero Image" },
  { key: "experiences-bath", section: "Experiences", label: "Soaking Tub" },
  { key: "experiences-reading-nook", section: "Experiences", label: "Reading Nook" },
  { key: "experiences-dining", section: "Experiences", label: "Private Dining" },
  { key: "experiences-pool", section: "Experiences", label: "Infinity Pool" },
  { key: "experiences-candle", section: "Experiences", label: "Artisan Candle" },
] as const;

export type SiteImageSlotKey = (typeof SITE_IMAGE_SLOTS)[number]["key"];

export const listSiteImages = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await serverPublic().from("site_images").select("slot_key, url");
  if (error) throw new Error(error.message);
  const map: Partial<Record<SiteImageSlotKey, string>> = {};
  for (const row of data ?? []) {
    if (row.url) map[row.slot_key as SiteImageSlotKey] = row.url;
  }
  return map;
});

/**
 * A slot's current image: the admin-set override if one exists, otherwise
 * the original hardcoded/static asset passed as `fallback`. Every call
 * site keeps rendering exactly as it does today until a row exists for
 * that slot — no visual change on first deploy of this feature.
 */
export function useSiteImage(key: SiteImageSlotKey, fallback: string): string {
  const { data } = useQuery({ queryKey: ["site-images"], queryFn: () => listSiteImages() });
  return data?.[key] ?? fallback;
}
