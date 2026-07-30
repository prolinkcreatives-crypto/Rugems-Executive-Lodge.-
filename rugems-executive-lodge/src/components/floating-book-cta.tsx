import { Link, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence, useMotionValueEvent, useScroll } from "framer-motion";
import { useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cinematic } from "./motion";

/**
 * A premium floating "Book Now" CTA.
 * - Mobile: visible on every non-/book page as soon as user starts to engage.
 * - Desktop: appears only after the user scrolls past the hero (~600px).
 * - Hidden entirely while inside the /book flow (the CTA is already the page).
 */
export function FloatingBookCTA() {
  const { location } = useRouterState();
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (v) => {
    // Mobile shows quickly, desktop waits past the hero
    setVisible(isMobile ? v > 120 : v > 600);
  });

  const onBookRoute = location.pathname.startsWith("/book");
  const shouldShow = !onBookRoute && visible;

  const btnRef = useRef<HTMLAnchorElement | null>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; size: number }[]>([]);
  const spawnRipple = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const size = Math.max(rect.width, rect.height);
    const id = Date.now();
    setRipples((r) => [...r, { id, x: e.clientX - rect.left - size / 2, y: e.clientY - rect.top - size / 2, size }]);
    window.setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 650);
  };

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.55, ease: cinematic }}
          className="fixed z-40 bottom-5 inset-x-0 flex justify-center pointer-events-none md:bottom-8 md:right-8 md:inset-x-auto md:left-auto md:justify-end"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <motion.div
            whileHover={{ y: -3, scale: 1.02 }}
            whileTap={{ scale: 0.97, y: 1 }}
            transition={{ duration: 0.25, ease: cinematic }}
            className="pointer-events-auto"
          >
            <Link
              ref={btnRef}
              to="/book"
              onClick={spawnRipple}
              aria-label="Book your stay at Rugems Executive Lodge"
              className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full bg-gradient-royal text-white pl-5 pr-6 py-3.5 text-label-caps shadow-cta ring-1 ring-gold/60 hover:shadow-cta-hover transition-shadow duration-300"
            >
              <span className="relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/20">
                <Calendar className="h-3.5 w-3.5 text-gold-soft" strokeWidth={2.25} />
              </span>
              <span className="relative z-10 tracking-[0.14em]">Book Now</span>
              {ripples.map((r) => (
                <span
                  key={r.id}
                  className="pointer-events-none absolute rounded-full bg-white/35 animate-ripple"
                  style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
                />
              ))}
            </Link>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
