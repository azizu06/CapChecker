"use client";

import { useEffect, useState } from "react";

/**
 * The Cap Score meter: three verdict bands that light by score, plus a pin that
 * sweeps to the score position on mount. This is the second beat of the single
 * hero moment (paired with the CountUp score reveal). CSS handles the transition
 * so prefers-reduced-motion (which zeroes transition durations) makes it instant.
 */
export function ScoreMeter({ score }: { score: number }) {
  const [pinLeft, setPinLeft] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setPinLeft(score));
    return () => cancelAnimationFrame(raf);
  }, [score]);

  return (
    <div className="meter-wrap">
      <div className="meter" aria-hidden="true">
        <i className={score >= 1 ? "lit" : undefined} />
        <i className={score >= 30 ? "lit" : undefined} />
        <i className={score >= 70 ? "lit" : undefined} />
        <span
          className="pin"
          style={{ left: `${Math.min(Math.max(pinLeft, 0), 100)}%` }}
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
