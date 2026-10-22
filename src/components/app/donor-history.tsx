"use client";

import { m } from "motion/react";
import { money } from "@/lib/format";

const W = 640;
const H = 64;
const BASE = 40;

/**
 * One donor's giving as a heartbeat: one beat per real gift PayPal charged, then the line runs flat to a coral
 * dot where the gift failed (sage again once it's recovered). Beat heights are equal: this shows rhythm, not size.
 */
export function DonorHistory({ gifts, failedAt, open }: { gifts: { at: string; cents: number; recovered: boolean }[]; failedAt: string; open: boolean }) {
  const regular = gifts.filter((g) => !g.recovered);
  const recovered = gifts.find((g) => g.recovered);
  const n = Math.max(regular.length, 1);
  const end = W - 28;
  const step = (end - 16) / (n + 1);
  const beat = (x: number) => `L${x - 7},${BASE} L${x - 3},${BASE + 3} L${x},${BASE - 26} L${x + 3},${BASE + 8} L${x + 7},${BASE}`;
  const path = `M0,${BASE} ${regular.map((_, i) => beat(16 + step * (i + 1))).join(" ")} L${end},${BASE}`;
  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" role="img" aria-label={`${regular.length} gifts, then a failed payment`}>
        <m.path d={path} fill="none" stroke="var(--brand)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: "easeInOut" }} />
        <m.circle cx={end + 6} cy={BASE} r={5} fill={open ? "var(--brand)" : "var(--recovered)"} stroke="var(--surface)" strokeWidth={2} initial={{ scale: 0 }} animate={{ scale: [0, 1.25, 1] }} transition={{ delay: 1.6, duration: 0.4 }} style={{ transformOrigin: `${end + 6}px ${BASE}px` }} />
        {open ? (
          <m.circle cx={end + 6} cy={BASE} r={5} fill="none" stroke="var(--brand)" strokeWidth={1.5} initial={{ scale: 1, opacity: 0.8 }} animate={{ scale: 2.6, opacity: 0 }} transition={{ delay: 1.9, duration: 1.6, repeat: Infinity, repeatDelay: 0.8 }} style={{ transformOrigin: `${end + 6}px ${BASE}px` }} />
        ) : null}
      </svg>
      <p className="sr-only">
        {regular.length} gifts of {money(regular[0]?.cents ?? 0)}, then a failed payment on {failedAt.slice(0, 10)}
        {recovered ? `, recovered ${recovered.at.slice(0, 10)}` : ""}.
      </p>
    </div>
  );
}
