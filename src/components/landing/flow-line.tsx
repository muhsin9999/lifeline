"use client";

import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";

// One heartbeat runs down the page: it leaves the hero's line at the left edge, turns down, and turns right into
// the "How a rescue works" strip. Each section marks where its line sits with data-flow / data-flow-y; this measures
// them and draws the turn between, so the sections read as one line rather than separate blocks. It draws in
// right after the hero line, so the line visibly carries on down the page.
const X = 24;
const R = 24;

export function FlowLine({ from, to }: { from: string; to: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [ys, setYs] = useState<{ a: number; b: number } | null>(null);

  useEffect(() => {
    const svg = ref.current;
    const host = svg?.parentElement;
    if (!host) return;
    const measure = () => {
      const top = host.getBoundingClientRect().top;
      const at = (name: string) => {
        const el = host.querySelector<HTMLElement>(`[data-flow="${name}"]`);
        if (!el || !el.offsetParent) return null;
        return el.getBoundingClientRect().top - top + Number(el.dataset.flowY ?? 0) + Number(el.dataset.flowOffset ?? 0);
      };
      const a = at(from);
      const b = at(to);
      setYs(a !== null && b !== null ? { a, b } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [from, to]);

  return (
    <svg ref={ref} aria-hidden className="pointer-events-none absolute inset-y-0 left-0 hidden h-full w-16 overflow-visible lg:block">
      {ys ? (
        <m.path
          d={`M${X + R},${ys.a} Q${X},${ys.a} ${X},${ys.a + R} L${X},${ys.b - R} Q${X},${ys.b} ${X + R},${ys.b}`}
          fill="none"
          stroke="var(--ink-muted)"
          strokeOpacity="0.45"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, delay: 1.2, ease: "easeInOut" }}
        />
      ) : null}
    </svg>
  );
}
