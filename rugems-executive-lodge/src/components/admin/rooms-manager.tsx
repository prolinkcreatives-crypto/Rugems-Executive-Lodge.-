import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImagePlus, Loader2, Pencil } from "lucide-react";
import { listSanctuaries } from "@/lib/atelier.functions";
import { updateSanctuaryPrice, uploadSanctuaryImage, deleteSanctuaryImage } from "@/lib/admin.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Sanctuary = Awaited<ReturnType<typeof listSanctuaries>>[number];

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

function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "Please choose a JPG, PNG, or WEBP image.";
  if (file.size > MAX_IMAGE_BYTES) return "Image must be under 5 MB.";
  return null;
}

export function RoomsManager() {
  const queryClient = useQueryClient();
  const roomsQuery = useQuery({ queryKey: ["sanctuaries"], queryFn: () => listSanctuaries() });
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

  const rooms = roomsQuery.data ?? [];
  const editing = rooms.find((r) => r.slug === editingSlug) ?? null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["sanctuaries"] });

  return (
    <div>
      {roomsQuery.isLoading && <p className="text-body-md text-on-surface-variant">Loading rooms…</p>}
      {roomsQuery.isError && (
        <p className="text-body-md text-destructive">Couldn't load rooms. Try refreshing the page.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room) => (
          <div
            key={room.slug}
            className="rounded-2xl border border-outline-variant bg-surface-container-lowest overflow-hidden"
          >
            <div className="aspect-[4/3] bg-surface-container">
              <img src={room.hero_image} alt={room.name} className="h-full w-full object-cover" />
            </div>
            <div className="p-5">
              <p className="text-headline-sm font-display text-primary">{room.name}</p>
              <p className="text-body-md text-on-surface-variant mt-1">
                K{room.price_per_night.toLocaleString()} / night
              </p>
              <button
                onClick={() => setEditingSlug(room.slug)}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-label-caps hover:shadow-ambient transition-all duration-300"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditingSlug(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {editing && <RoomEditor room={editing} onSaved={refresh} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoomEditor({ room, onSaved }: { room: Sanctuary; onSaved: () => void }) {
  const updatePrice = useServerFn(updateSanctuaryPrice);
  const uploadImage = useServerFn(uploadSanctuaryImage);
  const deleteImage = useServerFn(deleteSanctuaryImage);

  const [price, setPrice] = useState(String(room.price_per_night));
  const [savingPrice, setSavingPrice] = useState(false);
  // Tracks which single control is mid-request ("hero", "gallery-add", or a
  // specific gallery image URL) so only that one shows a spinner/disables.
  const [busy, setBusy] = useState<string | null>(null);

  const heroInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const replacingUrlRef = useRef<string | null>(null);

  async function savePrice() {
    const value = Number(price);
    if (!Number.isInteger(value) || value <= 0) {
      toast.error("Enter a whole number greater than zero.");
      return;
    }
    setSavingPrice(true);
    try {
      await updatePrice({ data: { slug: room.slug, pricePerNight: value } });
      toast.success("Price updated — new bookings will use this rate.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the price.");
    } finally {
      setSavingPrice(false);
    }
  }

  async function handleHeroReplace(file: File) {
    const err = validateImageFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setBusy("hero");
    try {
      const dataUrl = await fileToDataUrl(file);
      await uploadImage({ data: { slug: room.slug, imageBase64: dataUrl, fileName: file.name, target: "hero" } });
      toast.success("Featured image updated.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed — the previous image is still in place.");
    } finally {
      setBusy(null);
    }
  }

  async function handleGalleryUpload(file: File, replaceUrl: string | null) {
    const err = validateImageFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(replaceUrl ?? "gallery-add");
    try {
      const dataUrl = await fileToDataUrl(file);
      await uploadImage({
        data: { slug: room.slug, imageBase64: dataUrl, fileName: file.name, target: "gallery", replaceUrl: replaceUrl ?? undefined },
      });
      toast.success(replaceUrl ? "Image replaced." : "Image added to gallery.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed — nothing was changed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleGalleryDelete(url: string) {
    setBusy(url);
    try {
      await deleteImage({ data: { slug: room.slug, imageUrl: url } });
      toast.success("Image removed.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove that image.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-primary">{room.name}</DialogTitle>
        <DialogDescription>Update the nightly price or manage this room's photos.</DialogDescription>
      </DialogHeader>

      <div className="space-y-8 mt-2">
        <div>
          <p className="text-label-caps text-on-surface-variant mb-2">Price per night</p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 border-b border-outline-variant focus-within:border-primary py-2">
              <span className="text-body-md text-on-surface-variant">K</span>
              <input
                type="number"
                min={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-28 bg-transparent outline-none text-body-md text-on-surface"
              />
            </div>
            <button
              onClick={savePrice}
              disabled={savingPrice}
              className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-label-caps disabled:opacity-50 hover:shadow-ambient transition-all duration-300"
            >
              {savingPrice && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save Price
            </button>
          </div>
          <p className="text-label-caps text-on-surface-variant mt-2 opacity-70">
            Only affects new bookings — existing reservations keep the price they were made at.
          </p>
        </div>

        <div>
          <p className="text-label-caps text-on-surface-variant mb-2">Featured Image</p>
          <div className="flex items-center gap-4">
            <img
              src={room.hero_image}
              alt={room.name}
              className="h-24 w-32 object-cover rounded-lg border border-outline-variant"
            />
            <button
              onClick={() => heroInputRef.current?.click()}
              disabled={busy === "hero"}
              className="inline-flex items-center gap-2 rounded-full border border-outline-variant px-5 py-2.5 text-label-caps hover:border-primary hover:text-primary transition-all duration-300 disabled:opacity-50"
            >
              {busy === "hero" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
              Replace Image
            </button>
          </div>
          <input
            ref={heroInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) handleHeroReplace(file);
            }}
          />
        </div>

        <div>
          <p className="text-label-caps text-on-surface-variant mb-2">Gallery</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(room.gallery ?? []).map((url) => (
              <div key={url} className="relative rounded-lg overflow-hidden border border-outline-variant">
                <img src={url} alt="" className="h-28 w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1.5 bg-charcoal/70">
                  {busy === url ? (
                    <span className="flex-1 py-1 text-center">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-ivory inline" />
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          replacingUrlRef.current = url;
                          galleryInputRef.current?.click();
                        }}
                        className="flex-1 text-[11px] uppercase tracking-wide text-ivory hover:text-gold transition-colors"
                      >
                        Replace
                      </button>
                      <button
                        onClick={() => handleGalleryDelete(url)}
                        className="flex-1 text-[11px] uppercase tracking-wide text-ivory hover:text-destructive transition-colors"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            <button
              onClick={() => {
                replacingUrlRef.current = null;
                galleryInputRef.current?.click();
              }}
              disabled={busy === "gallery-add"}
              className="flex flex-col items-center justify-center gap-1 h-28 rounded-lg border border-dashed border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-all duration-300 disabled:opacity-50"
            >
              {busy === "gallery-add" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              <span className="text-[11px] uppercase tracking-wide">Add Image</span>
            </button>
          </div>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) handleGalleryUpload(file, replacingUrlRef.current);
            }}
          />
        </div>
      </div>
    </>
  );
}
