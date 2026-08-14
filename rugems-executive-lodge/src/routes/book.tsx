import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Check, ArrowRight, ArrowLeft, Calendar, Users, Shield, MapPin, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { Reveal, StaggerWords, GoldHairline, cinematic } from "@/components/motion";
import {
  listSanctuaries,
  createBooking,
  checkAvailability,
  isAvailabilityConflictError,
  availabilityConflictMessage,
} from "@/lib/atelier.functions";
import { LOCATIONS, getLocation, type LocationSlug } from "@/lib/business";

const searchSchema = z.object({ sanctuary: z.string().optional() });

const sanctuariesQuery = { queryKey: ["sanctuaries"], queryFn: () => listSanctuaries() };

export const Route = createFileRoute("/book")({
  validateSearch: (s) => searchSchema.parse(s),
  loader: ({ context }) => context.queryClient.ensureQueryData(sanctuariesQuery),
  head: () => ({
    meta: [
      { title: "Reserve your Stay · Rugems Executive Lodge" },
      { name: "description", content: "Reserve your stay at Rugems Executive Lodge — a guided, unhurried booking journey." },
    ],
  }),
  component: BookPage,
});

const steps = [
  { key: "sanctuary", label: "Room" },
  { key: "dates", label: "Dates & Guests" },
  { key: "location", label: "Location" },
  { key: "review", label: "Review" },
] as const;

const GUEST_OPTIONS: { count: number; emoji: string; label: string }[] = [
  { count: 1, emoji: "👤", label: "Solo Traveller" },
  { count: 2, emoji: "👥", label: "Couple" },
  { count: 3, emoji: "👨‍👩‍👧", label: "Three Guests" },
  { count: 4, emoji: "👨‍👩‍👧‍👦", label: "Four Guests" },
  { count: 5, emoji: "👨‍👩‍👧‍👦", label: "Five or More" },
];

type FormState = {
  sanctuarySlug: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  location: LocationSlug | "";
  guestName: string;
  email: string;
  phone: string;
  specialRequests: string;
};

type AvailabilityStatusValue = "idle" | "checking" | "available" | "unavailable" | "error";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Parses the y/m/d components manually and builds the Date in local time,
// rather than `new Date(iso)`, which JS treats as UTC midnight and can
// display as the previous day for guests west of Lusaka.
function formatHumanDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Review-step-specific checks only. Deliberately excludes room/branch/date
// existence (already guaranteed by the time a guest reaches step 3 — every
// earlier step gates its own Continue button) and excludes availability
// entirely (Milestone 2's concern, enforced separately via canAdvance()).
function reviewBlockingReason(form: FormState): string | null {
  if (form.guestName.trim().length < 2) return "Please enter your full name.";
  if (!/\S+@\S+\.\S+/.test(form.email)) return "Please enter a valid email address.";
  if (form.checkIn && form.checkIn < todayISO()) {
    return "Your check-in date has passed. Please return to Dates & Guests and choose a new date.";
  }
  return null;
}

function BookPage() {
  const { data: sanctuaries } = useSuspenseQuery(sanctuariesQuery);
  const initial = useSearch({ from: "/book" });
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({
    sanctuarySlug: initial.sanctuary ?? sanctuaries[0]?.slug ?? "",
    checkIn: "",
    checkOut: "",
    guests: 2,
    location: "",
    guestName: "",
    email: "",
    phone: "",
    specialRequests: "",
  });
  const [pulseKey, setPulseKey] = useState<string>("");
  const pulseFor = useCallback((key: string) => {
    setPulseKey(key);
    window.setTimeout(() => setPulseKey((k) => (k === key ? "" : k)), 700);
  }, []);

  const selected = sanctuaries.find((s) => s.slug === form.sanctuarySlug) ?? sanctuaries[0];
  const selectedLocation = getLocation(form.location);

  const nights = useMemo(() => {
    if (!form.checkIn || !form.checkOut) return 0;
    return Math.max(
      0,
      Math.round((new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 86_400_000),
    );
  }, [form.checkIn, form.checkOut]);
  const total = selected ? selected.price_per_night * nights : 0;

  const create = useServerFn(createBooking);
  const checkAvail = useServerFn(checkAvailability);
  const [submitting, setSubmitting] = useState(false);
  const availabilityCache = useRef(new Map<string, boolean>());
  const [availability, setAvailability] = useState<AvailabilityStatusValue>("idle");

  // Live availability check — re-runs whenever room, branch, or dates change,
  // debounced so a burst of changes (e.g. clicking through several rooms)
  // doesn't fire a request per click. Purely advisory: the real guarantee
  // against double-booking is the `bookings_no_overlapping_dates` exclusion
  // constraint from Milestone 1, enforced again — authoritatively — at
  // submit time in `submit()` below, so a stale or failed check here can
  // never let a genuine conflict through.
  useEffect(() => {
    const { sanctuarySlug, location, checkIn, checkOut } = form;
    if (!sanctuarySlug || !location || !checkIn || !checkOut || nights <= 0) {
      setAvailability("idle");
      return;
    }
    const key = `${sanctuarySlug}|${location}|${checkIn}|${checkOut}`;
    const cached = availabilityCache.current.get(key);
    if (cached !== undefined) {
      setAvailability(cached ? "available" : "unavailable");
      return;
    }
    let cancelled = false;
    setAvailability("checking");
    const timeoutId = window.setTimeout(async () => {
      try {
        const res = await checkAvail({ data: { sanctuarySlug, location, checkIn, checkOut } });
        if (cancelled) return;
        availabilityCache.current.set(key, res.available);
        setAvailability(res.available ? "available" : "unavailable");
      } catch {
        // Fail open — a check that couldn't complete shouldn't block a
        // guest from continuing; submit() is still protected either way.
        if (!cancelled) setAvailability("error");
      }
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [form.sanctuarySlug, form.location, form.checkIn, form.checkOut, nights, checkAvail]);

  // Review-step-specific checks: required fields actually filled in, and the
  // chosen check-in date hasn't quietly passed while the guest was on this
  // page. Independent of the availability effect above — that stays exactly
  // as Milestone 2 left it.
  const reviewIssue = step === 3 ? reviewBlockingReason(form) : null;

  const canAdvance = () => {
    // A confirmed conflict blocks progress from any step — no point letting
    // the guest continue toward a room/date combination already known to
    // be unavailable.
    if (availability === "unavailable") return false;
    if (step === 0) return Boolean(form.sanctuarySlug);
    if (step === 1) return nights > 0 && form.guests > 0;
    if (step === 2) return Boolean(form.location);
    if (step === 3) return reviewIssue === null;
    return true;
  };

  const submit = async () => {
    if (!selected || !form.location) return;
    setSubmitting(true);
    try {
      const res = await create({
        data: {
          sanctuarySlug: selected.slug,
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          guests: form.guests,
          guestName: form.guestName,
          email: form.email,
          phone: form.phone || undefined,
          specialRequests: form.specialRequests || undefined,
          location: form.location,
        },
      });
      toast.success("Reservation held. Proceed to secure it.");
      navigate({ to: "/payment/$reference", params: { reference: res.reference } });
    } catch (e) {
      if (isAvailabilityConflictError(e)) {
        // Someone else's stay now covers these dates — send the guest back
        // to Dates & Guests instead of leaving them stuck on Review.
        toast.error(availabilityConflictMessage(e));
        setStep(1);
      } else {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Stable update helpers — avoid recreating handler identities each render.
  const setSanctuary = useCallback(
    (slug: string) => {
      setForm((f) => (f.sanctuarySlug === slug ? f : { ...f, sanctuarySlug: slug }));
      pulseFor(`sanctuary:${slug}`);
    },
    [pulseFor],
  );
  const setGuests = useCallback(
    (n: number) => {
      setForm((f) => ({ ...f, guests: n }));
      pulseFor(`guests:${n}`);
    },
    [pulseFor],
  );
  const setLocationSlug = useCallback(
    (slug: LocationSlug) => {
      setForm((f) => ({ ...f, location: slug }));
      pulseFor(`location:${slug}`);
    },
    [pulseFor],
  );

  return (
    <>
      <Nav />
      <div className="pt-32 md:pt-40 pb-24 min-h-screen bg-surface">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <Reveal>
            <span className="text-label-caps text-gold">Reservation</span>
          </Reveal>
          <StaggerWords
            text="A guided arrival."
            as="h1"
            delay={0.15}
            className="text-headline-lg font-display text-primary mt-4"
          />
          <div className="mt-4 mb-14"><GoldHairline /></div>

          <Stepper step={step} onJump={(i) => i < step && setStep(i)} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 min-h-[420px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.45, ease: cinematic }}
                >
                  {step === 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                      {sanctuaries.map((s) => {
                        const isSelected = form.sanctuarySlug === s.slug;
                        const anySelected = Boolean(form.sanctuarySlug);
                        return (
                          <SanctuaryCard
                            key={s.slug}
                            s={s}
                            selected={isSelected}
                            dimmed={anySelected && !isSelected}
                            pulsing={pulseKey === `sanctuary:${s.slug}`}
                            onSelect={setSanctuary}
                          />
                        );
                      })}
                    </div>
                  )}

                  {step === 1 && (
                    <div className="space-y-10">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <FloatingInput
                          icon={<Calendar className="h-4 w-4" />}
                          label="Check-in"
                          confirmedLabel="Check-in selected"
                          type="date"
                          value={form.checkIn}
                          min={todayISO()}
                          onChange={(v) => {
                            setForm((f) => ({ ...f, checkIn: v }));
                            if (v) pulseFor("date:in");
                          }}
                        />
                        <FloatingInput
                          icon={<Calendar className="h-4 w-4" />}
                          label="Check-out"
                          confirmedLabel="Check-out selected"
                          type="date"
                          value={form.checkOut}
                          onChange={(v) => {
                            setForm((f) => ({ ...f, checkOut: v }));
                            if (v) pulseFor("date:out");
                          }}
                        />
                      </div>

                      <div>
                        <label className="text-label-caps text-on-surface-variant flex items-center gap-2 mb-5">
                          <Users className="h-4 w-4" /> Guests
                          {form.guests > 0 && (
                            <span className="ml-auto inline-flex items-center gap-1.5 text-gold normal-case tracking-normal">
                              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                              <span className="text-label-caps text-gold">
                                {GUEST_OPTIONS.find((g) => g.count === form.guests)?.label ?? `${form.guests} guests`} selected
                              </span>
                            </span>
                          )}
                        </label>
                        <div className="flex flex-wrap gap-3">
                          {GUEST_OPTIONS.map((g) => (
                            <GuestChip
                              key={g.count}
                              option={g}
                              selected={form.guests === g.count}
                              pulsing={pulseKey === `guests:${g.count}`}
                              onSelect={setGuests}
                            />
                          ))}
                        </div>
                      </div>

                      {nights > 0 && (
                        <motion.p
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-label-caps text-gold"
                        >
                          {nights} night{nights !== 1 && "s"} — a considered stay.
                        </motion.p>
                      )}
                    </div>
                  )}

                  {step === 2 && (
                    <div>
                      <p className="text-label-caps text-on-surface-variant mb-1">Choose Your Rugems Location</p>
                      <h2 className="text-headline-md font-display text-primary mb-6">
                        Two addresses. One unmistakable standard.
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {LOCATIONS.map((loc) => (
                          <LocationCard
                            key={loc.slug}
                            loc={loc}
                            selected={form.location === loc.slug}
                            dimmed={Boolean(form.location) && form.location !== loc.slug}
                            pulsing={pulseKey === `location:${loc.slug}`}
                            onSelect={setLocationSlug}
                          />
                        ))}
                      </div>
                      <AnimatePresence>
                        {selectedLocation && (
                          <motion.p
                            key={selectedLocation.slug}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.4, ease: cinematic }}
                            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary-fixed/60 border border-gold/40 px-5 py-2.5 text-label-caps text-primary"
                          >
                            <Check className="h-3.5 w-3.5 text-gold" strokeWidth={2.5} />
                            You are booking at {selectedLocation.name}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {step === 3 && selected && (
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <FloatingInput
                          label="Full name"
                          confirmedLabel="Name confirmed"
                          value={form.guestName}
                          onChange={(v) => setForm((f) => ({ ...f, guestName: v }))}
                        />
                        <FloatingInput
                          label="Email"
                          confirmedLabel="Email confirmed"
                          type="email"
                          value={form.email}
                          onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                        />
                        <FloatingInput
                          label="Phone (optional)"
                          confirmedLabel="Phone added"
                          value={form.phone}
                          onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                        />
                      </div>
                      <div>
                        <label className="text-label-caps text-on-surface-variant block mb-3">
                          Special requests
                        </label>
                        <textarea
                          rows={3}
                          value={form.specialRequests}
                          onChange={(e) => setForm((f) => ({ ...f, specialRequests: e.target.value }))}
                          placeholder="Dietary preferences, arrival times, celebrations..."
                          className="w-full bg-transparent border-b border-outline-variant focus:border-primary transition-colors py-3 text-body-md text-on-surface outline-none resize-none"
                        />
                      </div>

                      <ValidationNotice message={reviewIssue} />

                      <div className="bg-surface-container-lowest p-8 shadow-ambient gold-hairline space-y-5">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-label-caps text-gold">{selected.tagline}</p>
                            <h3 className="text-headline-md font-display text-primary mt-1">{selected.name}</h3>
                            {selectedLocation && (
                              <p className="text-body-md text-on-surface-variant mt-1 inline-flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-gold" /> {selectedLocation.short}
                              </p>
                            )}
                          </div>
                          <img
                            src={selected.hero_image}
                            alt={selected.name}
                            loading="lazy"
                            decoding="async"
                            className="h-24 w-32 object-cover rounded"
                          />
                        </div>
                        <div className="h-px bg-outline-variant" />

                        <ReviewSection title="Location">
                          <ReviewLine label="Branch" value={selectedLocation?.short ?? "—"} />
                        </ReviewSection>

                        <ReviewSection title="Accommodation">
                          <ReviewLine label="Room type" value={selected.name} />
                          <ReviewLine
                            label="Price per night"
                            value={`K${selected.price_per_night.toLocaleString()}`}
                          />
                        </ReviewSection>

                        <ReviewSection title="Stay">
                          <ReviewLine label="Check-in" value={formatHumanDate(form.checkIn)} />
                          <ReviewLine label="Check-out" value={formatHumanDate(form.checkOut)} />
                          <ReviewLine label="Nights" value={String(nights)} />
                        </ReviewSection>

                        <ReviewSection title="Guests">
                          <ReviewLine label="Number of guests" value={String(form.guests)} />
                        </ReviewSection>

                        {form.specialRequests.trim() && (
                          <ReviewSection title="Additional Requests">
                            <span className="text-on-surface-variant text-label-caps">Guest notes</span>
                            <p className="text-body-md text-on-surface mt-1">{form.specialRequests}</p>
                          </ReviewSection>
                        )}

                        <div className="h-px bg-outline-variant" />
                        <div className="flex justify-between items-baseline">
                          <p className="text-label-caps text-on-surface-variant">Total</p>
                          <p className="text-headline-lg font-display text-primary">K{total.toLocaleString()}</p>
                        </div>
                        <p className="text-label-caps text-on-surface-variant">
                          Reference{" "}
                          <span className="normal-case tracking-normal">
                            LMN-•••••••• — assigned once your reservation is held
                          </span>
                        </p>
                        <p className="text-label-caps text-on-surface-variant flex items-center gap-2 pt-2">
                          <Shield className="h-3.5 w-3.5 text-gold" /> Your reservation is held pending secure payment.
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <AvailabilityStatus status={availability} roomName={selected?.name} />

              <div className="flex justify-between items-center mt-12">
                <button
                  onClick={() => setStep(Math.max(0, step - 1))}
                  disabled={step === 0}
                  className="inline-flex items-center gap-2 text-label-caps text-on-surface-variant hover:text-primary transition-colors disabled:opacity-30"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                {step < steps.length - 1 ? (
                  <RippleButton
                    onClick={() => setStep(step + 1)}
                    disabled={!canAdvance()}
                    ariaDescribedBy={availability === "unavailable" ? "availability-status" : undefined}
                  >
                    Continue
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </RippleButton>
                ) : (
                  <RippleButton
                    onClick={submit}
                    disabled={submitting || !canAdvance()}
                    ariaDescribedBy={availability === "unavailable" ? "availability-status" : undefined}
                  >
                    {submitting ? "Holding your suite..." : "Hold Reservation"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </RippleButton>
                )}
              </div>
            </div>

            {/* Sidebar summary */}
            <aside className="lg:sticky lg:top-32 h-fit bg-surface-container-lowest p-8 shadow-ambient gold-hairline">
              {selected && (
                <>
                  <div className="aspect-[4/3] overflow-hidden mb-6">
                    <img src={selected.hero_image} alt={selected.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  </div>
                  <p className="text-label-caps text-gold">{selected.tagline}</p>
                  <h3 className="text-headline-md font-display text-primary mt-1">{selected.name}</h3>
                  <p className="text-body-md text-on-surface-variant">{selected.location}</p>
                  {selectedLocation && (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-label-caps text-primary">
                      <MapPin className="h-3.5 w-3.5 text-gold" /> {selectedLocation.short}
                    </p>
                  )}
                  <motion.div layout className="mt-6 space-y-3 text-body-md text-on-surface-variant">
                    <SummaryLine label={`K${selected.price_per_night} × ${nights || "–"} nights`} value={total ? `K${total.toLocaleString()}` : "—"} />
                    <SummaryLine label="Guests" value={form.guests ? String(form.guests) : "—"} />
                    <SummaryLine label="Location" value={selectedLocation?.short ?? "—"} />
                    <SummaryLine label="Concierge" value="Included" />
                  </motion.div>
                  <div className="mt-6 pt-6 border-t border-outline-variant flex justify-between items-baseline">
                    <span className="text-label-caps text-primary">Total</span>
                    <motion.span
                      key={total}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: cinematic }}
                      className="text-headline-md font-display text-gold"
                    >
                      {total ? `K${total.toLocaleString()}` : "—"}
                    </motion.span>
                  </div>
                  <p className="text-label-caps text-on-surface-variant mt-6">
                    Cancel free up to 14 days before arrival.
                  </p>
                </>
              )}
              <div className="mt-8 text-label-caps text-on-surface-variant">
                Questions?{" "}
                <Link to="/story" className="text-primary underline underline-offset-4">
                  Meet Rugems
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

/* ─────────────────────────── Stepper ─────────────────────────── */

const Stepper = memo(function Stepper({
  step,
  onJump,
}: {
  step: number;
  onJump: (i: number) => void;
}) {
  return (
    <div className="mb-14 flex items-center gap-2 md:gap-4 overflow-x-auto pb-2">
      {steps.map((s, i) => {
        const isDone = i < step;
        const isCurrent = i === step;
        const isFuture = i > step;
        return (
          <div key={s.key} className="flex items-center gap-2 md:gap-4 flex-shrink-0">
            <button
              type="button"
              onClick={() => onJump(i)}
              className="group flex items-center gap-3 focus-visible:outline-none"
              disabled={isFuture}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${s.label}`}
            >
              <span className="relative inline-flex h-12 w-12 items-center justify-center">
                {/* Champagne gold ring for the active step */}
                {isCurrent && (
                  <motion.span
                    aria-hidden
                    layoutId="step-active-ring"
                    className="absolute inset-[-4px] rounded-full ring-[1.5px] ring-gold"
                    transition={{ duration: 0.6, ease: cinematic }}
                  />
                )}

                {/* Circle */}
                <motion.span
                  initial={false}
                  animate={{ scale: isCurrent ? 1.06 : 1 }}
                  transition={{ duration: 0.45, ease: cinematic }}
                  className={
                    "relative h-11 w-11 rounded-full flex items-center justify-center " +
                    "backface-hidden will-change-transform " +
                    (isDone
                      ? "bg-gradient-royal ring-1 ring-gold shadow-select"
                      : isCurrent
                      ? "bg-gradient-royal ring-1 ring-gold/40 shadow-cta animate-step-breathe"
                      : "bg-surface-container-lowest ring-1 ring-outline-variant")
                  }
                  style={{ WebkitFontSmoothing: "antialiased" }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {isDone ? (
                      <motion.svg
                        key="check"
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.35, ease: cinematic }}
                        fill="none"
                        stroke="#f4e2a1"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <motion.path
                          d="M5 12.5l4.5 4.5L19 7.5"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.45, ease: cinematic, delay: 0.05 }}
                        />
                      </motion.svg>
                    ) : (
                      <motion.span
                        key="num"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.3, ease: cinematic }}
                        className={
                          "text-label-caps font-semibold tracking-normal " +
                          (isCurrent ? "text-white" : "text-on-surface-variant/70")
                        }
                        style={{ fontSize: "0.85rem", lineHeight: 1 }}
                      >
                        {i + 1}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.span>
              </span>

              <span
                className={
                  "text-label-caps hidden md:inline transition-colors duration-500 " +
                  (isCurrent
                    ? "text-primary"
                    : isDone
                    ? "text-gold"
                    : "text-on-surface-variant/70")
                }
              >
                {s.label}
              </span>
            </button>

            {i < steps.length - 1 && (
              <span
                className="relative h-px w-8 md:w-16 overflow-hidden rounded-full bg-outline-variant/60"
                aria-hidden
              >
                <motion.span
                  initial={false}
                  animate={{ scaleX: i < step ? 1 : 0 }}
                  transition={{ duration: 0.7, ease: cinematic }}
                  style={{ transformOrigin: "left" }}
                  className="absolute inset-0 bg-gradient-to-r from-gold via-gold to-gold-soft"
                />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
});


/* ───────────────────────── Sanctuary card ───────────────────────── */

const SanctuaryCard = memo(function SanctuaryCard({
  s,
  selected,
  dimmed,
  pulsing,
  onSelect,
}: {
  s: {
    slug: string;
    name: string;
    tagline: string;
    description: string;
    hero_image: string;
    price_per_night: number;
    amenities: string[];
  };
  selected: boolean;
  dimmed: boolean;
  pulsing: boolean;
  onSelect: (slug: string) => void;
}) {
  return (
    <motion.div
      initial={false}
      animate={{
        scale: selected ? 1.02 : 1,
        opacity: dimmed ? 0.55 : 1,
      }}
      whileHover={{ scale: selected ? 1.03 : 1.01, y: -3 }}
      transition={{ duration: 0.28, ease: cinematic }}
      className={
        "relative flex flex-col overflow-hidden rounded-md bg-surface-container-lowest transition-shadow duration-300 " +
        (selected
          ? "ring-1 ring-gold shadow-select"
          : "ring-1 ring-outline-variant hover:ring-gold/60 hover:shadow-ambient")
      }
    >
      <button
        type="button"
        onClick={() => onSelect(s.slug)}
        aria-pressed={selected}
        aria-label={`Select ${s.name}`}
        className="absolute inset-0 z-10"
      />

      {selected && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: cinematic }}
          className={
            "absolute top-3 right-3 z-20 h-9 w-9 rounded-full bg-gradient-royal ring-1 ring-gold flex items-center justify-center shadow-select " +
            (pulsing ? "animate-select-pulse" : "")
          }
        >
          <Check className="h-4 w-4 text-primary-foreground" strokeWidth={2.75} />
        </motion.span>
      )}

      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={s.hero_image}
          alt={s.name}
          loading="lazy"
          className={
            "h-full w-full object-cover transition-transform duration-[900ms] " +
            (selected ? "scale-105" : "group-hover:scale-105")
          }
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/70 via-primary/25 to-transparent p-4 flex items-end justify-between">
          <span className="text-label-caps text-white/90 tracking-widest">{s.tagline}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/30 backdrop-blur px-3 py-1 text-label-caps text-white/95 ring-1 ring-white/15">
            <Users className="h-3 w-3 text-gold" /> Sleeps 2
          </span>
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-headline-md font-display text-primary leading-tight">{s.name}</h3>
          <div className="text-right shrink-0">
            <p className="text-headline-lg font-display text-gold leading-none">
              K{s.price_per_night}
            </p>
            <p className="text-label-caps text-on-surface-variant mt-1">per night</p>
          </div>
        </div>

        <p className="text-body-md text-on-surface-variant leading-relaxed">{s.description}</p>

        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-body-sm text-on-surface pt-1">
          {s.amenities.map((a) => (
            <li key={a} className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-gold shrink-0" strokeWidth={2.5} />
              <span className="truncate">{a}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-2 relative z-20 pointer-events-none">
          <button
            type="button"
            onClick={() => onSelect(s.slug)}
            className={
              "pointer-events-auto w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-label-caps transition-all duration-300 " +
              (selected
                ? "bg-gradient-royal text-white ring-1 ring-gold shadow-select"
                : "border border-gold text-tertiary hover:bg-gold hover:text-primary")
            }
          >
            {selected ? (
              <>
                <Check className="h-4 w-4" strokeWidth={2.75} /> Room Selected
              </>
            ) : (
              <>
                Select Room <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
});

/* ─────────────────────────── Guest chip ─────────────────────────── */

const GuestChip = memo(function GuestChip({
  option,
  selected,
  pulsing,
  onSelect,
}: {
  option: { count: number; emoji: string; label: string };
  selected: boolean;
  pulsing: boolean;
  onSelect: (n: number) => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(option.count)}
      aria-pressed={selected}
      initial={false}
      animate={{ scale: selected ? 1.06 : 1 }}
      whileHover={{ scale: selected ? 1.08 : 1.03, y: -1 }}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.26, ease: cinematic }}
      className={
        "relative inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 text-body-md transition-shadow duration-300 " +
        (selected
          ? "bg-gradient-royal text-white ring-1 ring-gold shadow-select " +
            (pulsing ? "animate-select-pulse" : "")
          : "border border-outline-variant text-on-surface-variant hover:border-gold hover:text-primary hover:shadow-ambient")
      }
    >
      <span className="text-lg leading-none" aria-hidden>
        {option.emoji}
      </span>
      <span className={selected ? "text-white" : "text-on-surface"}>{option.label}</span>
      {selected && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: cinematic }}
          className="ml-1 inline-flex h-5 w-5 rounded-full bg-gold items-center justify-center"
        >
          <Check className="h-3 w-3 text-primary" strokeWidth={3} />
        </motion.span>
      )}
    </motion.button>
  );
});

/* ────────────────────────── Location card ────────────────────────── */

const LocationCard = memo(function LocationCard({
  loc,
  selected,
  dimmed,
  pulsing,
  onSelect,
}: {
  loc: (typeof LOCATIONS)[number];
  selected: boolean;
  dimmed: boolean;
  pulsing: boolean;
  onSelect: (slug: LocationSlug) => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(loc.slug)}
      aria-pressed={selected}
      initial={false}
      animate={{
        scale: selected ? 1.03 : 1,
        y: selected ? -4 : 0,
        opacity: dimmed ? 0.55 : 1,
        filter: dimmed ? "saturate(0.6)" : "saturate(1)",
      }}
      whileHover={{ scale: selected ? 1.04 : 1.015, y: selected ? -6 : -2 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.35, ease: cinematic }}
      className={
        "relative text-left group overflow-hidden rounded-lg transition-shadow duration-300 " +
        (selected
          ? "shadow-cta ring-2 ring-gold"
          : "ring-1 ring-outline-variant hover:ring-gold/60 hover:shadow-ambient")
      }
    >
      {selected && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, ease: cinematic }}
          className={
            "absolute top-4 right-4 z-20 h-9 w-9 rounded-full bg-gradient-royal ring-1 ring-gold flex items-center justify-center shadow-select " +
            (pulsing ? "animate-select-pulse" : "")
          }
        >
          <Check className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
        </motion.span>
      )}
      <div className="aspect-[16/10] overflow-hidden relative">
        <img
          src={loc.image}
          alt={loc.name}
          loading="lazy"
          width={1280}
          height={960}
          className={
            "h-full w-full object-cover transition-transform duration-700 " +
            (selected ? "scale-105" : "group-hover:scale-105")
          }
        />
        <div
          className={
            "absolute inset-0 pointer-events-none transition-opacity duration-500 " +
            (selected
              ? "bg-gradient-to-t from-primary/60 via-primary/15 to-transparent opacity-100"
              : "bg-gradient-to-t from-primary/40 via-transparent to-transparent opacity-80 group-hover:opacity-90")
          }
        />
      </div>
      <div
        className={
          "p-6 transition-colors duration-300 " +
          (selected ? "bg-gradient-royal" : "bg-surface-container-lowest")
        }
      >
        <div className="flex items-center gap-2">
          <MapPin className={"h-4 w-4 " + (selected ? "text-gold-soft" : "text-gold")} />
          <p className={"text-label-caps " + (selected ? "text-gold-soft" : "text-gold")}>
            {loc.tagline}
          </p>
        </div>
        <h3
          className={
            "text-headline-md font-display mt-2 " + (selected ? "text-white" : "text-primary")
          }
        >
          {loc.name}
        </h3>
        <p
          className={
            "text-label-caps mt-2 " + (selected ? "text-white/80" : "text-on-surface-variant")
          }
        >
          {loc.addressLines.join(" · ")}
        </p>
        <p
          className={
            "text-body-md mt-3 " + (selected ? "text-white/90" : "text-on-surface-variant")
          }
        >
          {loc.description}
        </p>
        <span
          className={
            "mt-5 inline-flex items-center gap-2 text-label-caps rounded-full px-4 py-2 transition-colors " +
            (selected
              ? "bg-gold text-primary"
              : "border border-outline-variant text-primary group-hover:border-gold")
          }
        >
          {selected ? "Selected" : "Select This Location"}
          {!selected && <ArrowRight className="h-3.5 w-3.5" />}
        </span>
      </div>
    </motion.button>
  );
});

/* ─────────────────────────── Ripple button ─────────────────────────── */

function RippleButton({
  onClick,
  disabled,
  children,
  ariaDescribedBy,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  ariaDescribedBy?: string;
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; size: number }[]>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const size = Math.max(rect.width, rect.height);
      const id = Date.now() + Math.random();
      setRipples((r) => [...r, { id, x: e.clientX - rect.left - size / 2, y: e.clientY - rect.top - size / 2, size }]);
      window.setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), 700);
    }
    onClick();
  };

  return (
    <motion.button
      ref={btnRef}
      onClick={handleClick}
      disabled={disabled}
      aria-describedby={ariaDescribedBy}
      whileHover={disabled ? undefined : { y: -2, scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.26, ease: cinematic }}
      className={
        "group relative overflow-hidden inline-flex items-center gap-3 rounded-full px-9 py-4 text-label-caps text-white transition-shadow duration-500 " +
        (disabled
          ? "bg-outline-variant text-on-surface-variant/70 cursor-not-allowed opacity-70"
          : "bg-gradient-royal ring-1 ring-gold/60 shadow-cta hover:shadow-cta-hover")
      }
    >
      {!disabled && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background:
              "radial-gradient(120px 60px at var(--mx,50%) 50%, color-mix(in oklab, var(--gold-soft) 40%, transparent), transparent 70%)",
          }}
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-3">{children}</span>
      {ripples.map((r) => (
        <span
          key={r.id}
          className="ripple-span"
          style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
        />
      ))}
    </motion.button>
  );
}

/* ─────────────────────────── Availability status ─────────────────────────── */

function AvailabilityStatus({
  status,
  roomName,
}: {
  status: AvailabilityStatusValue;
  roomName?: string;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {status !== "idle" && (
        <motion.div
          key={status}
          id="availability-status"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: cinematic }}
          className={
            "mt-8 flex items-start gap-2.5 rounded-2xl border px-5 py-3 text-label-caps leading-relaxed " +
            (status === "unavailable"
              ? "bg-destructive/10 border-destructive/30 text-destructive"
              : status === "error"
              ? "border-outline-variant text-on-surface-variant"
              : "bg-primary-fixed/60 border-gold/40 text-primary")
          }
        >
          {status === "checking" && (
            <Loader2 className="h-3.5 w-3.5 mt-0.5 shrink-0 animate-spin" />
          )}
          {status === "available" && (
            <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gold" strokeWidth={2.5} />
          )}
          {status === "unavailable" && <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
          <span>
            {status === "checking" && "Checking availability for your dates…"}
            {status === "available" &&
              (roomName
                ? `${roomName} is available for these dates.`
                : "Available for your selected dates.")}
            {status === "unavailable" &&
              "Those dates are no longer available for this room at this location."}
            {status === "error" &&
              "Couldn't confirm availability — we'll check again when you submit."}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────── Validation notice ─────────────────────────── */

const ValidationNotice = memo(function ValidationNotice({ message }: { message: string | null }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {message && (
        <motion.div
          key={message}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: cinematic }}
          className="flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-3 text-label-caps leading-relaxed text-destructive"
        >
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

/* ─────────────────────────── Floating input ─────────────────────────── */

function FloatingInput({
  label,
  confirmedLabel,
  value,
  onChange,
  type = "text",
  icon,
  min,
}: {
  label: string;
  confirmedLabel?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  icon?: React.ReactNode;
  min?: string;
}) {
  const [focused, setFocused] = useState(false);
  const filled = value.length > 0 || focused;
  const complete = value.length > 0 && !focused && confirmedLabel;
  return (
    <div className="relative pt-6">
      <motion.label
        animate={{
          y: filled ? 0 : 28,
          fontSize: filled ? 11 : 14,
          color: focused ? "var(--primary)" : complete ? "var(--gold)" : "var(--on-surface-variant)",
        }}
        transition={{ duration: 0.3, ease: cinematic }}
        className="pointer-events-none absolute left-0 top-0 text-label-caps flex items-center gap-2"
      >
        {complete ? (
          <span className="inline-flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-gold" strokeWidth={2.5} />
            {confirmedLabel}
          </span>
        ) : (
          <>
            {icon}
            {label}
          </>
        )}
      </motion.label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        min={min}
        className={
          "w-full bg-transparent border-b transition-colors py-3 text-body-md text-on-surface outline-none " +
          (complete ? "border-gold" : focused ? "border-primary" : "border-outline-variant")
        }
      />
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-label-caps text-gold">{title}</p>
      {children}
    </div>
  );
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-body-md">
      <span className="text-on-surface-variant text-label-caps">{label}</span>
      <span className="text-on-surface">{value || "—"}</span>
    </div>
  );
}
function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="text-on-surface">{value}</span>
    </div>
  );
}
