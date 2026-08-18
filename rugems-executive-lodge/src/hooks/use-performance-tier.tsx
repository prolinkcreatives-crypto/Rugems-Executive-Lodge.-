import * as React from "react";

export type PerformanceTier = "high" | "medium" | "low";

interface PerformanceInfo {
  /** "low" simplifies animation complexity; "medium"/"high" both get the full treatment. */
  tier: PerformanceTier;
  /** OS/browser-level reduced-motion preference (distinct from device capability). */
  prefersReducedMotion: boolean;
  /** True when the tier came from ?perf=, not automatic detection — for dev/QA use. */
  isOverridden: boolean;
}

const DEFAULT_INFO: PerformanceInfo = { tier: "high", prefersReducedMotion: false, isOverridden: false };

const PerformanceContext = React.createContext<PerformanceInfo>(DEFAULT_INFO);

function isPerformanceTier(value: string | null): value is PerformanceTier {
  return value === "low" || value === "medium" || value === "high";
}

/**
 * Reads a ?perf=low|medium|high override from the URL. Purely additive: no
 * real user's URL has this param, so it has no effect in production unless
 * someone deliberately adds it — meant for developers/QA to preview a tier
 * without spoofing navigator.deviceMemory or throttling a real device.
 * Read once per load, same as automatic detection.
 */
function getUrlOverride(): PerformanceTier | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("perf");
  return isPerformanceTier(value) ? value : null;
}

/**
 * Heuristic device-tier check. None of these signals are perfect on their
 * own, so we treat the weakest tripped signal as the answer — false
 * positives just mean a capable device gets slightly cheaper animations,
 * which is a safe trade; false negatives are the thing we actually want to
 * avoid. "medium" still gets the full animation treatment (mid-range should
 * hit 60fps); only "low" simplifies.
 */
function detectTier(): PerformanceTier {
  if (typeof navigator === "undefined") return "high";

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };

  if (nav.connection?.saveData) return "low";
  if (nav.connection?.effectiveType && /2g/.test(nav.connection.effectiveType)) return "low";
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) return "low";
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 2) return "low";

  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) return "medium";
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4) return "medium";

  return "high";
}

export function PerformanceProvider({ children }: { children: React.ReactNode }) {
  const [info, setInfo] = React.useState<PerformanceInfo>(DEFAULT_INFO);

  React.useEffect(() => {
    const override = getUrlOverride();
    if (override) {
      // eslint-disable-next-line no-console
      console.info(`[perf] tier overridden via ?perf=${override} — remove the param to resume auto-detection.`);
    }

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setInfo({
        tier: override ?? detectTier(),
        prefersReducedMotion: mql.matches,
        isOverridden: override !== null,
      });
    };
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return <PerformanceContext.Provider value={info}>{children}</PerformanceContext.Provider>;
}

/** Cheap context read — safe to call from every animated component. */
export function usePerformanceTier() {
  return React.useContext(PerformanceContext);
}
