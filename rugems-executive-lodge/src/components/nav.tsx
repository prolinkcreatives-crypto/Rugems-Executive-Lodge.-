import { Link, useRouterState } from "@tanstack/react-router";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cinematic } from "./motion";
import { usePerformanceTier } from "@/hooks/use-performance-tier";
import { BUSINESS, links } from "@/lib/business";

const NAV = [
  { to: "/story", label: "The Story" },
  { to: "/sanctuaries", label: "Sanctuaries" },
  { to: "/experiences", label: "Experiences" },
  { to: "/book", label: "Reserve" },
] as const;

export function Nav({ variant = "auto" }: { variant?: "auto" | "solid" }) {
  const [scrolled, setScrolled] = useState(variant === "solid");
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();
  const { location } = useRouterState();
  const { tier } = usePerformanceTier();
  const lowTier = tier === "low";

  useMotionValueEvent(scrollY, "change", (v) => {
    if (variant === "solid") return;
    setScrolled(v > 40);
  });

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  return (
    <>
      <motion.nav
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1.1, ease: cinematic, delay: 0.2 }}
        className="fixed top-4 md:top-6 left-0 right-0 z-40 px-4 md:px-8"
      >
        <div
          className={
            "mx-auto max-w-[1400px] rounded-full transition-all duration-500 border border-gold/25 " +
            (lowTier
              ? scrolled
                ? "bg-ivory shadow-[0_18px_50px_-20px_rgba(20,15,10,0.35)]"
                : "bg-ivory/95 shadow-[0_10px_35px_-18px_rgba(20,15,10,0.28)]"
              : scrolled
                ? "bg-ivory/95 backdrop-blur-xl shadow-[0_18px_50px_-20px_rgba(20,15,10,0.35)]"
                : "bg-ivory/70 backdrop-blur-md shadow-[0_10px_35px_-18px_rgba(20,15,10,0.28)]")
          }
        >
          <div className="flex items-center justify-between pl-3 pr-3 py-2 md:pl-5 md:pr-4 md:py-3">
            <Link
              to="/"
              aria-label={`${BUSINESS.name} — home`}
              className="flex items-center gap-3 md:gap-4 pr-2"
            >
              <span className="flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-full bg-ivory ring-1 ring-gold/50 shadow-[0_4px_14px_-4px_rgba(20,15,10,0.25)]">
                <span className="font-display text-primary text-xl md:text-2xl leading-none">R</span>
              </span>
              <span className="font-display text-primary text-xl md:text-2xl tracking-[0.06em] leading-none">
                Rugems
              </span>
            </Link>

            <ul className="hidden md:flex items-center gap-10 px-6">
              {NAV.slice(0, 3).map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={
                      "text-label-caps relative py-1 transition-colors duration-500 " +
                      (isActive(item.to)
                        ? "text-primary"
                        : "text-on-surface-variant hover:text-primary")
                    }
                  >
                    {item.label}
                    {isActive(item.to) && (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute inset-x-0 -bottom-1 h-px bg-gold"
                        transition={{ duration: 0.6, ease: cinematic }}
                      />
                    )}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3 md:gap-4">
              <Link
                to="/book"
                className="hidden md:inline-flex items-center gap-2 rounded-full bg-gradient-royal text-white ring-1 ring-gold/60 px-6 py-3 text-label-caps shadow-cta hover:shadow-cta-hover hover:-translate-y-0.5 transition-all duration-300"
              >
                Book Your Stay
              </Link>

              <button
                onClick={() => setOpen(true)}
                className="inline-flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-full bg-primary text-ivory ring-1 ring-gold/50 shadow-[0_6px_18px_-6px_rgba(20,15,10,0.5)] hover:bg-primary/90 hover:-translate-y-0.5 transition-all duration-300"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile sheet */}
      <motion.div
        initial={false}
        animate={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
        transition={{ duration: 0.4 }}
        className={
          "fixed inset-0 z-50 md:hidden " + (lowTier ? "bg-charcoal/85" : "bg-charcoal/70 backdrop-blur-md")
        }
        onClick={() => setOpen(false)}
      >
        <motion.aside
          initial={false}
          animate={{ x: open ? 0 : "100%" }}
          transition={{ duration: 0.6, ease: cinematic }}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 h-full w-[86%] max-w-sm bg-ivory p-8 flex flex-col"
        >
          <div className="flex items-center justify-between">
            <span className="text-headline-md text-primary font-display">RUGEMS</span>
            <button
              onClick={() => setOpen(false)}
              className="h-11 w-11 rounded-full flex items-center justify-center text-primary hover:bg-primary-fixed"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <ul className="mt-16 space-y-6">
            {NAV.map((item, i) => (
              <motion.li
                key={item.to}
                initial={{ opacity: 0, x: 20 }}
                animate={open ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
                transition={{ duration: 0.6, ease: cinematic, delay: 0.15 + i * 0.06 }}
              >
                <Link
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="block text-headline-md text-primary font-display"
                >
                  {item.label}
                </Link>
              </motion.li>
            ))}
          </ul>
          <div className="mt-auto space-y-2">
            <a href={links.tel} className="block text-label-caps text-primary">
              Call · {BUSINESS.phone}
            </a>
            <a
              href={links.whatsapp}
              target="_blank"
              rel="noreferrer"
              className="block text-label-caps text-on-surface-variant hover:text-primary transition-colors"
            >
              WhatsApp · {BUSINESS.whatsapp}
            </a>
          </div>
        </motion.aside>
      </motion.div>
    </>
  );
}
