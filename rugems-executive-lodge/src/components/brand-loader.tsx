import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { cinematic } from "./motion";

/** Branded loading overlay — first paint experience. Sub-second, elegant, single hero moment. */
export function BrandLoader({ minMs = 1400 }: { minMs?: number }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGone(true), minMs);
    return () => clearTimeout(t);
  }, [minMs]);
  return (
    <AnimatePresence>
      {!gone && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8, ease: cinematic } }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ivory"
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: cinematic }}
            className="flex flex-col items-center gap-6"
          >
            <motion.span
              className="text-label-caps text-gold"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              A moment of quiet
            </motion.span>
            <div className="relative">
              <span className="text-display-hero font-display text-primary tracking-[-0.02em]">
                RUGEMS
              </span>
              <motion.span
                aria-hidden
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1.2, ease: cinematic, delay: 0.3 }}
                className="absolute -bottom-2 left-0 right-0 h-px bg-gold origin-left"
              />
            </div>
            <motion.span
              className="text-label-caps text-on-surface-variant tracking-[0.4em]"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.8, ease: cinematic }}
            >
              E X E C U T I V E  L O D G E
            </motion.span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
