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
 *
 * Static specs alone are not enough: a device like the Galaxy A32
 * (Helio G80, 8 reported cores, 4-8GB RAM depending on variant) reports
 * hardwareConcurrency/deviceMemory values that land this heuristic on
 * "medium" or "high" even though its actual per-core performance is weak —
 * six of those eight cores are low-power Cortex-A55 efficiency cores, not
 * six real performance cores. Core *count* isn't a reliable proxy for
 * real-world performance on modern budget/mid-range ARM big.LITTLE chips.
 * runtimeBenchmarkMs() below measures actual execution speed on the
 * device as a tie-breaker, rather than trusting what it claims to be.
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

// A cheap, deliberately short synchronous benchmark — representative
// floating-point work, not a real workload, just enough to expose a slow
// CPU. ~50k iterations keeps the blocking window under a few ms even on a
// genuinely weak device, which matters since this itself adds to the
// hydration-time cost this whole audit is trying to reduce.
//
// The 8ms threshold is a reasoned estimate, not empirically calibrated
// against real hardware — this sandbox has no device lab. Verify against
// an actual Galaxy A32 (the console.info below prints the measured value)
// and adjust if it's mis-classifying that device either direction.
const BENCHMARK_ITERATIONS = 50_000;
const BENCHMARK_SLOW_MS = 8;

function runtimeBenchmarkMs(): number {
  const start = performance.now();
  let x = 0;
  for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
    x += Math.sqrt(i) * Math.sin(i);
  }
  // Reference x so the loop can't be optimized away as dead code.
  if (x === Number.NaN) console.log(x);
  return performance.now() - start;
}

/**
 * Runs the benchmark at most once per browser session — this is meant to
 * catch a persistently weak device, not to re-measure on every navigation
 * within the same session.
 */
function isSlowByBenchmark(): boolean {
  try {
    const cached = sessionStorage.getItem("perf-benchmark-ms");
    const ms = cached !== null ? Number(cached) : runtimeBenchmarkMs();
    if (cached === null) sessionStorage.setItem("perf-benchmark-ms", String(ms));
    // eslint-disable-next-line no-console
    console.info(`[perf] runtime benchmark: ${ms.toFixed(1)}ms (slow threshold: ${BENCHMARK_SLOW_MS}ms)`);
    return ms > BENCHMARK_SLOW_MS;
  } catch {
    // sessionStorage unavailable (private browsing, etc.) — benchmark
    // every load rather than fail; still cheap and short-lived.
    return runtimeBenchmarkMs() > BENCHMARK_SLOW_MS;
  }
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
      let tier = override ?? detectTier();
      // Only benchmark when specs alone said medium/high — if we're
      // already confident it's low, there's no need for the extra work.
      if (!override && tier !== "low" && isSlowByBenchmark()) {
        tier = "low";
      }
      setInfo({
        tier,
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
