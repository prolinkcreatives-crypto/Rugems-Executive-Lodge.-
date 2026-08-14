import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { cinematic } from "./motion";

/** Page transition wrapper — fades pages during route change. */
export function PageTransition({ children }: { children: ReactNode }) {
  const { location } = useRouterState();
  return (
    <AnimatePresence mode="wait">
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.6, ease: cinematic }}
      >
        {children}
      </motion.main>
    </AnimatePresence>
  );
}
