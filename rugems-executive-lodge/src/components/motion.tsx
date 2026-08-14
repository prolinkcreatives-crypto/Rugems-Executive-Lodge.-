import { motion, useInView, useScroll, useTransform, type Variants } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { usePerformanceTier } from "@/hooks/use-performance-tier";

/** Cinematic easing curve consistent across the site. */
export const cinematic = [0.16, 1, 0.3, 1] as const;

function useSimplifyMotion() {
  const { tier, prefersReducedMotion } = usePerformanceTier();
  return tier === "low" || prefersReducedMotion;
}

/** Fade-and-rise reveal — used for paragraphs, images, sections. */
export function Reveal({
  children,
  delay = 0,
  y = 32,
  className,
  once = true,
  amount = 0.2,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
  amount?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, amount });
  const simplify = useSimplifyMotion();

  const riseY = simplify ? Math.min(y, 14) : y;
  const duration = simplify ? 0.5 : 1.1;
  const effectiveDelay = simplify ? Math.min(delay, 0.15) : delay;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: riseY }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: riseY }}
      transition={{ duration, ease: cinematic, delay: effectiveDelay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Image mask reveal — the image is uncovered from left to right. */
export function MaskImage({
  src,
  alt,
  className,
  imgClassName,
  direction = "left",
  delay = 0,
  parallax = 0,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  direction?: "left" | "right" | "up";
  delay?: number;
  parallax?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const simplify = useSimplifyMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [parallax * -1 * 60, parallax * 60]);

  // Parallax is a decorative layer on top of the reveal itself — the first
  // thing to drop on constrained devices, since it keeps recomputing for as
  // long as the image is on screen rather than animating once and settling.
  const applyParallax = parallax && !simplify;

  const initialClip =
    direction === "left"
      ? "inset(0 100% 0 0)"
      : direction === "right"
        ? "inset(0 0 0 100%)"
        : "inset(100% 0 0 0)";

  return (
    <div ref={ref} className={"overflow-hidden " + (className ?? "")}>
      <motion.img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        initial={{ clipPath: initialClip, scale: 1.02 }}
        animate={inView ? { clipPath: "inset(0 0 0 0)", scale: 1 } : {}}
        transition={{ duration: simplify ? 0.6 : 1.4, ease: cinematic, delay: simplify ? Math.min(delay, 0.15) : delay }}
        style={applyParallax ? { y } : undefined}
        className={"h-full w-full object-cover " + (imgClassName ?? "")}
      />
    </div>
  );
}

/** Split a heading into words that stagger in with an ink-reveal. */
export function StaggerWords({
  text,
  className,
  delay = 0,
  wordDelay = 0.08,
  as: Tag = "h1",
}: {
  text: string;
  className?: string;
  delay?: number;
  wordDelay?: number;
  as?: "h1" | "h2" | "h3" | "p" | "span";
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const simplify = useSimplifyMotion();

  const words = text.split(" ");
  const effectiveWordDelay = simplify ? Math.min(wordDelay, 0.03) : wordDelay;
  const wordDuration = simplify ? 0.45 : 1.1;
  const effectiveDelay = simplify ? Math.min(delay, 0.15) : delay;

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: effectiveWordDelay, delayChildren: effectiveDelay } },
  };
  // No filter/blur animation: fade + rise only, so every word reveal stays
  // on the cheap transform+opacity path instead of forcing a per-word
  // filter repaint.
  const word: Variants = {
    hidden: { opacity: 0, y: "60%" },
    show: { opacity: 1, y: 0, transition: { duration: wordDuration, ease: cinematic } },
  };
  const MotionTag = motion[Tag] as typeof motion.h1;
  return (
    <MotionTag
      ref={ref}
      className={className}
      variants={container}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      aria-label={text}
    >
      {words.map((w, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden align-bottom pb-[0.15em] mr-[0.25em]">
          <motion.span variants={word} className="inline-block will-change-transform">
            {w}
          </motion.span>
        </span>
      ))}
    </MotionTag>
  );
}

/** Split into letters — for shorter, statement headings. */
export function StaggerLetters({
  text,
  className,
  delay = 0,
  as: Tag = "h1",
}: {
  text: string;
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "h3" | "p" | "span";
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const simplify = useSimplifyMotion();

  const letters = Array.from(text);
  const staggerChildren = simplify ? 0.015 : 0.035;
  const duration = simplify ? 0.4 : 0.9;
  const effectiveDelay = simplify ? Math.min(delay, 0.15) : delay;
  const MotionTag = motion[Tag] as typeof motion.h1;
  return (
    <MotionTag
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      variants={{ hidden: {}, show: { transition: { staggerChildren, delayChildren: effectiveDelay } } }}
      aria-label={text}
    >
      {letters.map((ch, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden align-bottom">
          <motion.span
            variants={{
              hidden: { y: "110%", opacity: 0 },
              show: { y: 0, opacity: 1, transition: { duration, ease: cinematic } },
            }}
            className="inline-block will-change-transform"
          >
            {ch === " " ? "\u00A0" : ch}
          </motion.span>
        </span>
      ))}
    </MotionTag>
  );
}

/** A thin animated hairline used as a decorative section separator. */
export function GoldHairline({ className = "" }: { className?: string }) {
  return (
    <motion.div
      initial={{ scaleX: 0, opacity: 0 }}
      whileInView={{ scaleX: 1, opacity: 1 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 1.1, ease: cinematic }}
      className={"h-px w-24 origin-left bg-gold " + className}
    />
  );
}

/** Parallax section wrapper for background layers. */
export function ParallaxY({
  children,
  strength = 100,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const simplify = useSimplifyMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-strength, strength]);
  return (
    <div ref={ref} className={className}>
      <motion.div style={simplify ? undefined : { y }}>{children}</motion.div>
    </div>
  );
}

/** Floating decorative sparkle — a tiny gold dot. */
export function GoldSparkle({ className, delay = 0 }: { className?: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0 });
  const simplify = useSimplifyMotion();

  return (
    <motion.span
      ref={ref}
      aria-hidden
      className={"absolute block rounded-full bg-gold shadow-[0_0_20px_var(--gold)] " + (className ?? "")}
      initial={{ opacity: 0.4, scale: 1 }}
      animate={
        inView && !simplify
          ? { opacity: [0.4, 1, 0.4], scale: [1, 1.4, 1] }
          : { opacity: 0.7, scale: 1 }
      }
      transition={
        inView && !simplify
          ? { duration: 3.6, ease: "easeInOut", repeat: Infinity, delay }
          : { duration: 0.6, ease: cinematic, delay: Math.min(delay, 0.15) }
      }
    />
  );
}
