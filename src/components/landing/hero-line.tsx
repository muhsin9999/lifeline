"use client";

import { m } from "motion/react";

// A faint heartbeat behind the hero: steady beats, one coral failure that goes flat, then sage beats as the gift
// comes back. It draws once on load, the same story the page tells.
const beat = (x: number) => `L${x},60 l6,-7 l7,26 l8,-48 l7,38 l5,-9`;
const xs = [60, 190, 320, 450, 580];
const ok = [900, 1030, 1160, 1290, 1420];

export function HeroLine() {
  return (
    <svg viewBox="0 0 1500 120" preserveAspectRatio="none" aria-hidden className="pointer-events-none absolute inset-x-0 bottom-2 hidden h-24 w-full opacity-70 lg:block">
      <m.path d={`M0,60 ${xs.map(beat).join(" ")} L700,60`} fill="none" stroke="var(--ink-muted)" strokeOpacity="0.25" strokeWidth="1.5" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: "easeInOut" }} />
      <m.path d="M700,60 l6,-7 l7,26 l8,-48 l7,38 l5,-9 L880,60" fill="none" stroke="var(--brand)" strokeOpacity="0.5" strokeWidth="1.5" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 1.6 }} />
      <m.path d={`M880,60 ${ok.map(beat).join(" ")} L1500,60`} fill="none" stroke="var(--recovered)" strokeOpacity="0.45" strokeWidth="1.5" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, delay: 2.2, ease: "easeInOut" }} />
    </svg>
  );
}
