import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Clock,
  Upload,
  CheckCircle2,
  XCircle,
  Search,
  X,
  Eye,
  AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Nav } from "@/components/nav";
import { StaggerWords, GoldHairline, cinematic } from "@/components/motion";
import {
  listAllBookings,
  updateBookingStatus,
  updateBookingNotes,
  currentUserIsAdmin,
  ALLOWED_STATUS_TRANSITIONS,
  type BookingStatus,
} from "@/lib/admin.functions";
import { getLocation } from "@/lib/business";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Rugems Executive Lodge — Admin" }] }),
  component: AdminPage,
});

type Booking = Awaited<ReturnType<typeof listAllBookings>>[number];

const FILTERS = ["all", "pending_payment", "payment_submitted", "confirmed", "cancelled"] as const;

const STATUS_META: Record<string, { label: string; className: string; dot: string; Icon: LucideIcon }> = {
  pending_payment: {
    label: "Pending Payment",
    className: "bg-primary-fixed text-on-primary-fixed",
    dot: "bg-primary",
    Icon: Clock,
  },
  payment_submitted: {
    label: "Payment Submitted",
    className: "bg-gold/20 text-tertiary border border-gold/40",
    dot: "bg-gold",
    Icon: Upload,
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-primary text-on-primary",
    dot: "bg-primary",
    Icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
    Icon: XCircle,
  },
};

function statusMeta(status: string) {
  return (
    STATUS_META[status] ?? {
      label: status.replace("_", " "),
      className: "bg-surface-container text-on-surface-variant",
      dot: "bg-on-surface-variant",
      Icon: Clock,
    }
  );
}

function actionLabel(from: string, to: string): string {
  if (to === "cancelled") return from === "payment_submitted" ? "Reject booking" : "Cancel booking";
  if (to === "confirmed") return "Approve booking";
  if (to === "pending_payment") return "Return to Pending Payment";
  return `Move to ${to.replace("_", " ")}`;
}

function statusActions(status: BookingStatus) {
  return ALLOWED_STATUS_TRANSITIONS[status].map((next) => ({
    next,
    label: actionLabel(status, next),
    destructive: next === "cancelled",
  }));
}

// Parses y/m/d manually and builds the Date in local time, rather than
// `new Date(iso)`, which JS treats as UTC midnight and can display as the
// previous day for staff west of Lusaka. Slices to the first 10 characters
// first so it works for both bare dates and full timestamps.
function formatHumanDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatHumanDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.max(0, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000));
}

function isBookingStatus(value: string): value is BookingStatus {
  return value in ALLOWED_STATUS_TRANSITIONS;
}

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const checkAdmin = useServerFn(currentUserIsAdmin);
  const listBookings = useServerFn(listAllBookings);
  const setStatus = useServerFn(updateBookingStatus);

  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<{ booking: Booking; next: BookingStatus } | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => checkAdmin() });
  const bookingsQ = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: () => listBookings(),
    enabled: adminQ.data?.isAdmin === true,
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const rows = useMemo(() => bookingsQ.data ?? [], [bookingsQ.data]);

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.reference.toLowerCase().includes(q) ||
        r.guest_name.toLowerCase().includes(q) ||
        (r.phone ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const filtered = useMemo(
    () => (filter === "all" ? searched : searched.filter((r) => r.status === filter)),
    [searched, filter],
  );

  // Keep an open detail dialog in sync with the cache (e.g. right after an
  // optimistic status/notes update) instead of freezing on stale data.
  useEffect(() => {
    if (!selected) return;
    const fresh = rows.find((r) => r.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [rows, selected]);

  // Optimistic, targeted update: patches only the one changed row in the
  // cache immediately, rolls back on failure. The patch also approximates
  // updated_at (the bookings_updated_at trigger sets this server-side on
  // every write regardless of which column changed), so there's nothing
  // left to reconcile with a follow-up invalidate/refetch — avoiding an
  // unnecessary full-list re-fetch for a change that only touched one row.
  const applyStatusChange = async (booking: Booking, next: BookingStatus) => {
    const previous = qc.getQueryData<Booking[]>(["admin-bookings"]);
    const optimisticUpdatedAt = new Date().toISOString();
    qc.setQueryData<Booking[]>(["admin-bookings"], (old) =>
      old?.map((b) => (b.id === booking.id ? { ...b, status: next, updated_at: optimisticUpdatedAt } : b)),
    );
    setChangingStatus(true);
    try {
      await setStatus({ data: { id: booking.id, status: next } });
      toast.success(`Status updated to ${statusMeta(next).label}`);
      setAnnouncement(`Booking ${booking.reference} status updated to ${statusMeta(next).label}.`);
    } catch (e) {
      qc.setQueryData(["admin-bookings"], previous);
      toast.error(e instanceof Error ? e.message : "Couldn't update status");
    } finally {
      setChangingStatus(false);
      setPendingChange(null);
    }
  };

  if (adminQ.isLoading) {
    return (
      <>
        <Nav variant="solid" />
        <div className="pt-40 text-center">
          <motion.div className="mx-auto h-8 w-8 rounded-full border-2 border-primary border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} />
        </div>
      </>
    );
  }
  if (!adminQ.data?.isAdmin) {
    return (
      <>
        <Nav variant="solid" />
        <div className="pt-40 min-h-screen text-center px-6">
          <h1 className="text-headline-lg font-display text-primary">This section is by invitation.</h1>
          <p className="text-body-md text-on-surface-variant mt-4">Your account does not have admin access.</p>
          <button onClick={signOut} className="mt-8 text-label-caps text-primary underline">Sign out</button>
        </div>
      </>
    );
  }

  return (
    <>
      <Nav variant="solid" />
      <div role="status" aria-live="polite" className="sr-only">{announcement}</div>
      <div className="pt-32 md:pt-40 pb-24 min-h-screen bg-surface">
        <div className="mx-auto max-w-[1400px] px-6 md:px-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-label-caps text-gold">Rugems Console</p>
              <StaggerWords text="Reservations." as="h1" delay={0.1} className="text-headline-lg font-display text-primary mt-2" />
            </div>
            <button onClick={signOut} className="text-label-caps text-on-surface-variant hover:text-primary transition-colors">
              Sign out
            </button>
          </div>
          <div className="my-6"><GoldHairline /></div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={
                    "text-label-caps rounded-full px-5 py-2 transition-all duration-300 " +
                    (filter === s
                      ? "bg-primary text-on-primary shadow-ambient"
                      : "border border-outline-variant text-on-surface-variant hover:border-primary")
                  }
                >
                  {s.replace("_", " ")}
                  {s !== "all" && <span className="ml-2 opacity-60">{rows.filter((r) => r.status === s).length}</span>}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-72">
              <Search className="h-4 w-4 text-on-surface-variant absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reference, guest, or phone"
                aria-label="Search bookings by reference, guest name, or phone number"
                className="w-full bg-transparent border border-outline-variant rounded-full pl-11 pr-9 py-2.5 text-body-md focus:border-primary transition-colors outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: cinematic }}
            className="bg-surface-container-lowest gold-hairline shadow-ambient overflow-x-auto"
          >
            <table className="w-full text-body-md">
              <thead>
                <tr className="text-label-caps text-on-surface-variant border-b border-outline-variant">
                  <th className="text-left p-4">Ref</th>
                  <th className="text-left p-4">Guest</th>
                  <th className="text-left p-4">Sanctuary</th>
                  <th className="text-left p-4">Location</th>
                  <th className="text-left p-4">Dates</th>
                  <th className="text-right p-4">Guests</th>
                  <th className="text-right p-4">Total</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Booked</th>
                  <th className="text-left p-4">Proof</th>
                  <th className="text-left p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, i) => (
                  <motion.tr
                    key={b.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.03, ease: cinematic }}
                    className="border-b border-outline-variant/60 hover:bg-primary-fixed/30 transition-colors"
                  >
                    <td className="p-4 font-mono text-label-caps text-primary">{b.reference}</td>
                    <td className="p-4">
                      <p className="text-on-surface">{b.guest_name}</p>
                      <p className="text-label-caps text-on-surface-variant">{b.email}</p>
                    </td>
                    <td className="p-4 text-on-surface">{b.sanctuary_name}</td>
                    <td className="p-4 text-label-caps text-primary">
                      {getLocation(b.location)?.short ?? "—"}
                    </td>
                    <td className="p-4 text-on-surface-variant text-label-caps">
                      {b.check_in} → {b.check_out}
                    </td>
                    <td className="p-4 text-right text-on-surface-variant">{b.guests}</td>
                    <td className="p-4 text-right font-display text-primary">K{b.total_amount.toLocaleString()}</td>
                    <td className="p-4">
                      <StatusPill status={b.status} />
                    </td>
                    <td className="p-4 text-label-caps text-on-surface-variant">{formatHumanDate(b.created_at)}</td>
                    <td className="p-4">
                      {b.proof_signed_url ? (
                        <button
                          type="button"
                          onClick={() => setLightboxUrl(b.proof_signed_url)}
                          className="text-label-caps text-primary underline underline-offset-4"
                        >
                          View
                        </button>
                      ) : (
                        <span className="text-label-caps text-on-surface-variant/60">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <select
                          value={b.status}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (!isBookingStatus(next) || next === b.status) return;
                            setPendingChange({ booking: b, next });
                          }}
                          aria-label={`Change status for booking ${b.reference}`}
                          className="bg-transparent border border-outline-variant text-label-caps px-3 py-1.5 rounded-full focus:border-primary outline-none"
                        >
                          <option value={b.status}>{statusMeta(b.status).label}</option>
                          {ALLOWED_STATUS_TRANSITIONS[b.status].map((s) => (
                            <option key={s} value={s}>{statusMeta(s).label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setSelected(b)}
                          aria-label={`View details for booking ${b.reference}`}
                          className="text-primary hover:text-gold transition-colors shrink-0"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-16 text-center text-on-surface-variant">
                      {rows.length === 0 ? "No reservations here yet." : "No bookings match your search or filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </motion.div>
        </div>
      </div>

      <BookingDetailDialog
        booking={selected}
        onOpenChange={(open) => !open && setSelected(null)}
        onRequestStatusChange={(booking, next) => setPendingChange({ booking, next })}
        onViewProof={(url) => setLightboxUrl(url)}
        onAnnounce={setAnnouncement}
      />
      <ProofLightbox url={lightboxUrl} onOpenChange={(open) => !open && setLightboxUrl(null)} />

      <AlertDialog open={pendingChange !== null} onOpenChange={(open) => !open && !changingStatus && setPendingChange(null)}>
        <AlertDialogContent className="bg-surface-container-lowest gold-hairline shadow-ambient-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-primary flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-gold" /> Confirm status change
            </AlertDialogTitle>
            <AlertDialogDescription className="text-on-surface-variant">
              {pendingChange && (
                <>
                  Move booking <span className="font-mono text-primary">{pendingChange.booking.reference}</span> from{" "}
                  <strong className="text-on-surface">{statusMeta(pendingChange.booking.status).label}</strong> to{" "}
                  <strong className="text-on-surface">{statusMeta(pendingChange.next).label}</strong>?
                  {pendingChange.next === "cancelled" && " This cannot be undone from this dashboard."}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={changingStatus}>Go back</AlertDialogCancel>
            <AlertDialogAction
              disabled={changingStatus}
              onClick={(e) => {
                e.preventDefault();
                if (pendingChange) applyStatusChange(pendingChange.booking, pendingChange.next);
              }}
              className={pendingChange?.next === "cancelled" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {changingStatus ? "Updating…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function StatusPill({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span className={"inline-flex items-center gap-1.5 text-label-caps px-3 py-1 rounded-full " + meta.className}>
      <meta.Icon className="h-3 w-3" /> {meta.label}
    </span>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-label-caps text-gold">{title}</p>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-body-md gap-4">
      <span className="text-on-surface-variant text-label-caps shrink-0">{label}</span>
      <span className="text-on-surface text-right">{value || "—"}</span>
    </div>
  );
}

function BookingDetailDialog({
  booking,
  onOpenChange,
  onRequestStatusChange,
  onViewProof,
  onAnnounce,
}: {
  booking: Booking | null;
  onOpenChange: (open: boolean) => void;
  onRequestStatusChange: (booking: Booking, next: BookingStatus) => void;
  onViewProof: (url: string) => void;
  onAnnounce: (message: string) => void;
}) {
  const qc = useQueryClient();
  const saveNotes = useServerFn(updateBookingNotes);
  const [notes, setNotes] = useState(booking?.admin_notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [thumbBroken, setThumbBroken] = useState(false);

  // Reset the local draft whenever a different booking is opened, not on
  // every render of the same one.
  useEffect(() => {
    setNotes(booking?.admin_notes ?? "");
    setThumbBroken(false);
  }, [booking?.id, booking?.admin_notes]);

  if (!booking) return null;

  const location = getLocation(booking.location);
  const nights = nightsBetween(booking.check_in, booking.check_out);
  const actions = statusActions(booking.status);

  // True optimistic update: reflects the note immediately, rolls back to
  // whatever was cached before if the save fails. updated_at is patched
  // too since the bookings_updated_at trigger bumps it server-side on
  // every write, so there's nothing left to reconcile with a refetch.
  const handleSaveNotes = async () => {
    const previous = qc.getQueryData<Booking[]>(["admin-bookings"]);
    const optimisticUpdatedAt = new Date().toISOString();
    qc.setQueryData<Booking[]>(["admin-bookings"], (old) =>
      old?.map((b) => (b.id === booking.id ? { ...b, admin_notes: notes, updated_at: optimisticUpdatedAt } : b)),
    );
    setSavingNotes(true);
    try {
      await saveNotes({ data: { id: booking.id, notes } });
      toast.success("Note saved");
      onAnnounce(`Note saved for booking ${booking.reference}.`);
    } catch (e) {
      qc.setQueryData(["admin-bookings"], previous);
      toast.error(e instanceof Error ? e.message : "Couldn't save note");
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <Dialog open={Boolean(booking)} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-container-lowest gold-hairline shadow-ambient-lg max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-primary text-headline-md">{booking.sanctuary_name}</DialogTitle>
          <DialogDescription className="text-label-caps text-on-surface-variant font-mono">
            {booking.reference}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          <StatusPill status={booking.status} />

          <DetailSection title="Guest">
            <DetailRow label="Name" value={booking.guest_name} />
            <DetailRow label="Email" value={booking.email} />
            <DetailRow label="Phone" value={booking.phone ?? ""} />
          </DetailSection>

          <DetailSection title="Accommodation">
            <DetailRow label="Room" value={booking.sanctuary_name} />
            <DetailRow label="Branch" value={location?.short ?? "—"} />
          </DetailSection>

          <DetailSection title="Stay">
            <DetailRow label="Check-in" value={formatHumanDate(booking.check_in)} />
            <DetailRow label="Check-out" value={formatHumanDate(booking.check_out)} />
            <DetailRow label="Nights" value={String(nights)} />
            <DetailRow label="Guests" value={String(booking.guests)} />
          </DetailSection>

          <DetailSection title="Payment">
            <DetailRow label="Total amount" value={`K${booking.total_amount.toLocaleString()}`} />
            <DetailRow label="Airtel transaction ref" value={booking.payment_reference ?? "Not submitted"} />
          </DetailSection>

          {booking.special_requests && (
            <DetailSection title="Special Requests">
              <p className="text-body-md text-on-surface whitespace-pre-wrap">{booking.special_requests}</p>
            </DetailSection>
          )}

          <DetailSection title="Payment Proof">
            {booking.proof_signed_url && !thumbBroken ? (
              <div>
                <button
                  type="button"
                  onClick={() => onViewProof(booking.proof_signed_url!)}
                  className="block w-full text-left"
                >
                  <img
                    src={booking.proof_signed_url}
                    alt="Payment proof thumbnail"
                    onError={() => setThumbBroken(true)}
                    className="h-40 w-full object-cover rounded-md border border-outline-variant hover:opacity-90 transition-opacity cursor-zoom-in"
                  />
                </button>
                <div className="flex items-center gap-4 mt-2">
                  <button
                    type="button"
                    onClick={() => onViewProof(booking.proof_signed_url!)}
                    className="text-label-caps text-primary underline underline-offset-4"
                  >
                    Click to enlarge
                  </button>
                  <a
                    href={booking.proof_signed_url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-label-caps text-primary underline underline-offset-4"
                  >
                    Download
                  </a>
                </div>
              </div>
            ) : booking.proof_signed_url && thumbBroken ? (
              <p className="text-body-md text-destructive">
                Couldn't load this screenshot — the link may have expired. Try closing and reopening this booking.
              </p>
            ) : (
              <p className="text-body-md text-on-surface-variant">No screenshot uploaded yet.</p>
            )}
          </DetailSection>

          <DetailSection title="Timeline">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-gold mt-1.5 shrink-0" />
                <div>
                  <p className="text-body-md text-on-surface">Reservation created</p>
                  <p className="text-label-caps text-on-surface-variant">{formatHumanDateTime(booking.created_at)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${statusMeta(booking.status).dot}`} />
                <div>
                  <p className="text-body-md text-on-surface">Current status: {statusMeta(booking.status).label}</p>
                  <p className="text-label-caps text-on-surface-variant">
                    Last updated {formatHumanDateTime(booking.updated_at)}
                  </p>
                </div>
              </div>
            </div>
          </DetailSection>

          <DetailSection title="Admin Notes">
            <p className="text-label-caps text-on-surface-variant/70 -mt-1 mb-1">Private — never visible to the guest.</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Add a note for other staff…"
              aria-label="Admin notes for this booking"
              className="w-full bg-transparent border border-outline-variant rounded-md focus:border-primary transition-colors p-3 text-body-md text-on-surface outline-none resize-none whitespace-pre-wrap"
            />
            <button
              type="button"
              onClick={handleSaveNotes}
              disabled={savingNotes || notes === (booking.admin_notes ?? "")}
              className="text-label-caps text-primary underline underline-offset-4 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {savingNotes ? "Saving…" : "Save note"}
            </button>
          </DetailSection>

          {actions.length > 0 && (
            <DetailSection title="Actions">
              <div className="flex flex-wrap gap-3">
                {actions.map((a) => (
                  <button
                    key={a.next}
                    type="button"
                    onClick={() => onRequestStatusChange(booking, a.next)}
                    className={
                      "text-label-caps px-5 py-2.5 rounded-full transition-all duration-300 " +
                      (a.destructive
                        ? "border border-destructive/40 text-destructive hover:bg-destructive/10"
                        : "bg-primary text-on-primary hover:shadow-ambient")
                    }
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </DetailSection>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProofLightbox({ url, onOpenChange }: { url: string | null; onOpenChange: (open: boolean) => void }) {
  const [zoomed, setZoomed] = useState(false);
  const [broken, setBroken] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  const goFullscreen = () => {
    const el = frameRef.current;
    if (el?.requestFullscreen) el.requestFullscreen();
  };

  return (
    <Dialog
      open={url !== null}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          setZoomed(false);
          setBroken(false);
        }
      }}
    >
      <DialogContent className="bg-surface-container-lowest gold-hairline shadow-ambient-lg max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-display text-primary text-headline-md">Payment screenshot</DialogTitle>
          <DialogDescription className="text-on-surface-variant">
            {broken
              ? "This screenshot couldn't be loaded."
              : "Click the image, or use the buttons below, to zoom or view full screen."}
          </DialogDescription>
        </DialogHeader>
        {url && !broken && (
          <div
            ref={frameRef}
            className="relative bg-surface rounded-md overflow-auto max-h-[70vh] flex items-center justify-center"
          >
            <img
              src={url}
              alt="Payment proof screenshot"
              onClick={() => setZoomed((z) => !z)}
              onError={() => setBroken(true)}
              className={
                "transition-transform duration-300 " +
                (zoomed ? "scale-150 cursor-zoom-out" : "max-h-[65vh] w-auto cursor-zoom-in")
              }
            />
          </div>
        )}
        {url && broken && (
          <p className="text-body-md text-destructive py-8 text-center">
            The link may have expired. Close this and reopen the booking to try again.
          </p>
        )}
        {url && !broken && (
          <div className="flex justify-end gap-6 mt-2">
            <button
              type="button"
              onClick={() => setZoomed((z) => !z)}
              aria-pressed={zoomed}
              className="text-label-caps text-primary underline underline-offset-4"
            >
              {zoomed ? "Zoom out" : "Zoom in"}
            </button>
            <button
              type="button"
              onClick={goFullscreen}
              className="text-label-caps text-primary underline underline-offset-4"
            >
              Open full screen
            </button>
            <a
              href={url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="text-label-caps text-primary underline underline-offset-4"
            >
              Download
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
