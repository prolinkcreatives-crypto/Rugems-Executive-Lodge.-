import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Clock, X } from "lucide-react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { StaggerWords, Reveal, GoldHairline, GoldSparkle, cinematic } from "@/components/motion";
import { getBookingByReference } from "@/lib/atelier.functions";
import { BUSINESS, getLocation, links } from "@/lib/business";

export const Route = createFileRoute("/confirmation/$reference")({
  head: () => ({ meta: [{ title: `Reservation received · ${BUSINESS.name}` }] }),
  component: ConfirmationPage,
});

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

function statusDisplay(status: string | undefined) {
  switch (status) {
    case "confirmed":
      return { label: "Confirmed", Icon: Check, className: "bg-primary/10 border-primary/40 text-primary" };
    case "cancelled":
      return { label: "Cancelled", Icon: X, className: "bg-destructive/10 border-destructive/30 text-destructive" };
    case "payment_submitted":
    default:
      return { label: "Payment Submitted", Icon: Clock, className: "bg-gold/15 border-gold/40 text-tertiary" };
  }
}

function ConfirmationPage() {
  const { reference } = Route.useParams();
  const getBooking = useServerFn(getBookingByReference);
  const { data: booking } = useQuery({
    queryKey: ["booking", reference],
    queryFn: () => getBooking({ data: { reference } }),
  });
  const status = statusDisplay(booking?.status);

  return (
    <>
      <Nav />
      <div className="pt-32 md:pt-40 pb-24 min-h-screen bg-surface relative overflow-hidden">
        <GoldSparkle className="left-[15%] top-[30%] h-1.5 w-1.5" />
        <GoldSparkle className="right-[20%] top-[45%] h-1 w-1" delay={0.8} />
        <GoldSparkle className="left-[35%] bottom-[25%] h-1 w-1" delay={1.5} />

        <div className="mx-auto max-w-3xl px-6 text-center relative z-10">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: cinematic, delay: 0.2 }}
            className="mx-auto mb-10 h-20 w-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-ambient-lg"
          >
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.6, ease: cinematic, delay: 0.6 }}
            >
              <Check className="h-8 w-8" />
            </motion.span>
          </motion.div>

          <Reveal>
            <span className="text-label-caps text-gold">Reservation received</span>
          </Reveal>
          <StaggerWords
            text="Thank you. Your suite awaits."
            as="h1"
            delay={0.4}
            className="text-headline-lg md:text-display-hero font-display text-primary mt-6 leading-[1.1]"
          />
          <Reveal delay={0.9}>
            <p className="text-body-lg text-on-surface-variant mt-8 max-w-xl mx-auto">
              We have received your Airtel Money payment. Our team will verify the transaction and
              personally confirm your stay — typically within a few hours.
            </p>
          </Reveal>

          <Reveal delay={1}>
            <div className={`mt-8 inline-flex items-center gap-2 rounded-full border px-5 py-2 text-label-caps ${status.className}`}>
              <status.Icon className="h-3.5 w-3.5" /> {status.label}
            </div>
          </Reveal>

          <div className="my-10 flex justify-center"><GoldHairline /></div>

          {booking && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: cinematic, delay: 1 }}
              className="bg-surface-container-lowest p-8 gold-hairline shadow-ambient text-left"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-label-caps text-on-surface-variant">Reference</p>
                  <p className="text-headline-md font-display text-primary mt-1 font-mono">{booking.reference}</p>
                </div>
                <div className="text-right">
                  <p className="text-label-caps text-on-surface-variant">Total</p>
                  <p className="text-headline-md font-display text-primary mt-1">K{booking.total_amount.toLocaleString()}</p>
                </div>
              </div>
              <div className="h-px bg-outline-variant my-6" />
              <dl className="grid grid-cols-2 gap-6 text-body-md">
                <div>
                  <dt className="text-label-caps text-on-surface-variant">Suite</dt>
                  <dd className="text-on-surface mt-1">{booking.sanctuary_name}</dd>
                </div>
                <div>
                  <dt className="text-label-caps text-on-surface-variant">Location</dt>
                  <dd className="text-on-surface mt-1">
                    {getLocation(booking.location)?.name ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-label-caps text-on-surface-variant">Guest</dt>
                  <dd className="text-on-surface mt-1">{booking.guest_name}</dd>
                </div>
                <div>
                  <dt className="text-label-caps text-on-surface-variant">Check-in</dt>
                  <dd className="text-on-surface mt-1">
                    {formatHumanDate(booking.check_in)}
                    <span className="block text-label-caps text-on-surface-variant mt-1">
                      {BUSINESS.hours.checkIn}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-label-caps text-on-surface-variant">Check-out</dt>
                  <dd className="text-on-surface mt-1">
                    {formatHumanDate(booking.check_out)}
                    <span className="block text-label-caps text-on-surface-variant mt-1">
                      {BUSINESS.hours.checkOut}
                    </span>
                  </dd>
                </div>
              </dl>
              <div className="h-px bg-outline-variant my-6" />
              <p className="text-label-caps text-on-surface-variant">
                Questions? Call {BUSINESS.phone} · WhatsApp {BUSINESS.whatsapp}
              </p>
            </motion.div>
          )}

          <Reveal delay={0.4}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/"
                className="rounded-full bg-primary text-primary-foreground px-8 py-3.5 text-label-caps hover:-translate-y-0.5 hover:shadow-ambient-lg transition-all duration-500 inline-flex items-center gap-3"
              >
                Return home
              </Link>
              <a
                href={links.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-primary text-primary px-8 py-3.5 text-label-caps hover:bg-primary-fixed/40 transition-all duration-500 inline-flex items-center gap-3"
              >
                Contact the lodge
              </a>
              <Link
                to="/experiences"
                className="text-label-caps text-primary underline underline-offset-8 decoration-gold"
              >
                Preview your experiences
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
      <Footer />
    </>
  );
}
