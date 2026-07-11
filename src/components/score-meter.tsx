"use client";

import { useEffect, useState } from "react";

/**
 * The Cap Score meter: three verdict bands that light by score, plus a pin that
 * sweeps to the score position on mount. This is the second beat of the single
 * hero moment (paired with the CountUp score reveal). With reduced motion, the
 * pin starts at its final position and does not schedule the sweep.
 */
export function ScoreMeter({ score }: { score: number }) {
  const finalPinLeft = Math.min(Math.max(score, 0), 100);
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [pinLeft, setPinLeft] = useState(() =>
    prefersReducedMotion ? finalPinLeft : 0,
  );

  useEffect(() => {
    if (prefersReducedMotion) return;

    const raf = requestAnimationFrame(() => setPinLeft(finalPinLeft));
    return () => cancelAnimationFrame(raf);
  }, [finalPinLeft, prefersReducedMotion]);

  return (
    <div className="meter-wrap">
      <div className="meter" aria-hidden="true">
        <i className={score >= 1 ? "lit" : undefined} />
        <i className={score >= 30 ? "lit" : undefined} />
        <i className={score >= 70 ? "lit" : undefined} />
        <span
          className="pin"
          style={{ left: `${prefersReducedMotion ? finalPinLeft : pinLeft}%` }}
        />
      </div>
      <div className="meter-labels" aria-label="Cap Score bands; higher is worse">
        <span>No cap 0–29</span>
        <span>Some cap 30–69</span>
        <span>Full of cap 70–100</span>
      </div>
    </div>
  );
}
