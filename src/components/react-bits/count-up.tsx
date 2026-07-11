"use client";

/**
 * CountUp — adapted from React Bits (https://reactbits.dev, DavidHDev/react-bits).
 *
 * The upstream component animates with framer-motion springs. This is a plain,
 * dependency-free variant re-tokened for CapCheck: it drives the value with
 * requestAnimationFrame and an ease-out curve, and honors prefers-reduced-motion
 * by jumping straight to the target. It powers the single hero moment — the Cap
 * Score reveal on scorecard mount.
 */

import { useEffect, useRef, useState } from "react";

type CountUpProps = {
  to: number;
  from?: number;
  durationMs?: number;
  className?: string;
};

// Animate only when we can both detect motion preference and drive frames.
// Environments without matchMedia or rAF (jsdom, SSR) jump straight to the
// target: deterministic for tests and safe when reduced-motion is unknowable.
const canAnimate = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  typeof window.requestAnimationFrame === "function" &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function CountUp({
  to,
  from = 0,
  durationMs = 1100,
  className,
}: CountUpProps) {
  const [value, setValue] = useState(() => (canAnimate() ? from : to));
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    // The initializer already resolves the resting value; only animate when we
    // can drive frames, updating state asynchronously inside the rAF callback.
    if (!canAnimate()) return;

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [to, from, durationMs]);

  return <span className={className}>{value}</span>;
}
