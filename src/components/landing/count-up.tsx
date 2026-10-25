"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

// Counts a figure like "27%", "1 in 10" or "$129B" up from zero the first time it scrolls into view. The server
// renders the real figure, so it reads right without JavaScript; the count writes straight to the text.
export function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.8 });
  const still = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    const match = value.match(/^(\D*?)(\d+(?:\.\d+)?)(.*)$/);
    if (!el || !match || still) return;
    const [, before, num, after] = match;
    if (!seen) {
      el.textContent = `${before}0${after}`;
      return;
    }
    const controls = animate(0, Number(num), { duration: 1.4, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => (el.textContent = `${before}${Math.round(v)}${after}`) });
    return () => controls.stop();
  }, [seen, still, value]);

  return (
    <p ref={ref} className={className} aria-label={value}>
      {value}
    </p>
  );
}
