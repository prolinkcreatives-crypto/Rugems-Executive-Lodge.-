import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImagePlus, Loader2 } from "lucide-react";
import { listSiteImages, SITE_IMAGE_SLOTS, type SiteImageSlotKey } from "@/lib/site-images";
import { uploadSiteImage } from "@/lib/admin.functions";

// Original/default image for each slot — the same fallbacks used on the
// public pages, so what the admin sees here matches what a visitor sees
// when no override has been set yet.
import heroEntranceAsset from "@/assets/hero-new-avondale-entrance.webp";
import receptionLobbyAsset from "@/assets/reception-lobby.webp";
import { LOCATIONS } from "@/lib/business";

const DEFAULT_IMAGE: Record<SiteImageSlotKey, string> = {
  "homepage-hero": heroEntranceAsset,
  "homepage-reception": receptionLobbyAsset,
  "homepage-suite-preview": "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1600&q=85",
  "location-new-avondale": LOCATIONS.find((l) => l.slug === "new-avondale")!.image,
  "location-ranchdale": LOCATIONS.find((l) => l.slug === "ranchdale")!.image,
  "story-hero": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=2000&q=85",
  "story-wood-detail": "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=85",
  "story-corridor": "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=2000&q=85",
  "story-artisan-hands": "https://images.unsplash.com/photo-1524230572899-a752b3835840?w=800&q=85",
  "story-textiles": "https://images.unsplash.com/photo-1615529182904-14819c35db37?w=800&q=85",
  "experiences-hero": "https://images.unsplash.com/photo-1571508601891-ca5e7a713859?w=2000&q=85",
  "experiences-bath": "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=1400&q=85",
  "experiences-reading-nook": "https://images.unsplash.com/photo-1616627981793-ee7d92858c6c?w=800&q=85",
  "experiences-dining": "https://images.unsplash.com/photo-1519821172144-4f87d85de2a4?w=1400&q=85",
  "experiences-pool": "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200&q=85",
  "experiences-candle": "https://images.unsplash.com/photo-1602928298849-325cec8771c0?w=800&q=85",
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function WebsiteImagesManager() {
  const queryClient = useQueryClient();
  const uploadImage = useServerFn(uploadSiteImage);
  const overridesQuery = useQuery({ queryKey: ["site-images"], queryFn: () => listSiteImages() });
  const [busySlot, setBusySlot] = useState<SiteImageSlotKey | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeSlotRef = useRef<SiteImageSlotKey | null>(null);

  const overrides = overridesQuery.data ?? {};

  async function handleReplace(slotKey: SiteImageSlotKey, file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Please choose a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image must be under 5 MB.");
      return;
    }
    setBusySlot(slotKey);
    try {
      const dataUrl = await fileToDataUrl(file);
      await uploadImage({ data: { slotKey, imageBase64: dataUrl, fileName: file.name } });
      toast.success("Image updated — the public site will use it immediately.");
      queryClient.invalidateQueries({ queryKey: ["site-images"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed — the previous image is still in place.");
    } finally {
      setBusySlot(null);
    }
  }

  const sections = Array.from(new Set(SITE_IMAGE_SLOTS.map((s) => s.section)));

  return (
    <div className="space-y-12">
      <p className="text-body-md text-on-surface-variant max-w-2xl">
        Every image below is a fixed spot already used on the live website. Replacing one updates that spot only —
        it doesn't create a new section or affect room photos, which are managed separately under Rooms.
      </p>

      {overridesQuery.isLoading && <p className="text-body-md text-on-surface-variant">Loading…</p>}

      {sections.map((section) => (
        <div key={section}>
          <p className="text-label-caps text-gold mb-4">{section}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SITE_IMAGE_SLOTS.filter((s) => s.section === section).map((slot) => {
              const src = overrides[slot.key] ?? DEFAULT_IMAGE[slot.key];
              const busy = busySlot === slot.key;
              return (
                <div
                  key={slot.key}
                  className="rounded-2xl border border-outline-variant bg-surface-container-lowest overflow-hidden"
                >
                  <div className="aspect-[4/3] bg-surface-container">
                    <img src={src} alt={slot.label} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-4">
                    <p className="text-body-md text-on-surface">{slot.label}</p>
                    <button
                      onClick={() => {
                        activeSlotRef.current = slot.key;
                        fileInputRef.current?.click();
                      }}
                      disabled={busy}
                      className="mt-3 inline-flex items-center gap-2 rounded-full border border-outline-variant px-4 py-2 text-label-caps hover:border-primary hover:text-primary transition-all duration-300 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                      Replace
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          const slotKey = activeSlotRef.current;
          if (file && slotKey) handleReplace(slotKey, file);
        }}
      />
    </div>
  );
}
