import { motion, useInView, useScroll, useTransform, type Variants } from "framer-motion";
import { useRef, type ReactNode } from "react";

/** Cinematic easing curve consistent across the site. */
export const cinematic = [0.16, 1, 0.3, 1] as const;

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
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 1.1, ease: cinematic, delay }}
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
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [parallax * -1 * 60, parallax * 60]);

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
        transition={{ duration: 1.4, ease: cinematic, delay }}
        style={parallax ? { y } : undefined}
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
  const words = text.split(" ");
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: wordDelay, delayChildren: delay } },
  };
  const word: Variants = {
    hidden: { opacity: 0, y: "60%", filter: "blur(6px)" },
    show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 1.1, ease: cinematic } },
  };
  const MotionTag = motion[Tag] as typeof motion.h1;
  return (
    <MotionTag className={className} variants={container} initial="hidden" animate="show" aria-label={text}>
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
  const letters = Array.from(text);
  const MotionTag = motion[Tag] as typeof motion.h1;
  return (
    <MotionTag
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.035, delayChildren: delay } } }}
      aria-label={text}
    >
      {letters.map((ch, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden align-bottom">
          <motion.span
            variants={{
              hidden: { y: "110%", opacity: 0 },
              show: { y: 0, opacity: 1, transition: { duration: 0.9, ease: cinematic } },
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
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-strength, strength]);
  return (
    <div ref={ref} className={className}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}

/** Floating decorative sparkle — a tiny gold dot. */
export function GoldSparkle({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.span
      aria-hidden
      className={"absolute block rounded-full bg-gold shadow-[0_0_20px_var(--gold)] " + (className ?? "")}
      animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.4, 1] }}
      transition={{ duration: 3.6, ease: "easeInOut", repeat: Infinity, delay }}
    />
  );
}
