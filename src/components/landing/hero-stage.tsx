"use client";

import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { HeroAgent } from "./hero-agent";

// The hero's heartbeat, with the agent card sitting on it at the moment a gift failed. Grey beats are gifts going
// through; the coral dip is Cora's real failed gift on 23 Oct; after the card the line waits, faint, until the note
// is approved in the replay, then beats again in sage. The line starts at the left edge where it turns down into
// "How a rescue works" (FlowLine draws that turn).
const BASE = 130;
const H = 260;
export const HERO_LINE_X = 48;

const beat = (x: number, up = 58) => `L${x - 16},${BASE} l5,-6 l6,10 l7,-${up} l8,${up + 22} l6,-16 l4,0 L${x + 22},${BASE}`;

export function HeroStage() {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const card = { w: 380, cx: w * 0.6 };
  const left = card.cx - card.w / 2;
  const right = card.cx + card.w / 2;
  const dipX = left - 90;
  const greys: number[] = [];
  for (let x = dipX - 150; x > HERO_LINE_X + 40; x -= 150) greys.unshift(x);
  const greens: number[] = [];
  for (let x = right + 90; x < w - 40; x += 150) greens.push(x);

  return (
    <div ref={box} data-flow="hero" data-flow-y={300} className="relative hidden lg:block" style={{ height: 600 }}>
      {w ? (
        <svg width={w} height={H} className="pointer-events-none absolute inset-x-0 overflow-visible" style={{ top: 300 - BASE }} aria-hidden>
          <m.path d={`M${HERO_LINE_X},${BASE} ${greys.map((x) => beat(x)).join(" ")} L${dipX - 40},${BASE}`} fill="none" stroke="var(--ink-muted)" strokeOpacity="0.7" strokeWidth="2" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: "easeInOut" }} />
          <m.path d={`M${dipX - 40},${BASE} l14,-26 l10,26 L${dipX - 6},${BASE} L${dipX},${BASE + 62} L${dipX + 8},${BASE} L${left},${BASE}`} fill="none" stroke="var(--brand)" strokeWidth="2.2" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 1.4 }} />
          <m.circle cx={dipX} cy={BASE + 66} r="5" fill="var(--brand)" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 2 }} />
          <m.text x={dipX} y={BASE + 96} textAnchor="middle" className="fill-brand-strong text-[13px] font-medium" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.1 }}>
            Cora&apos;s $1 gift failed · 23 Oct
          </m.text>
          {sent ? (
            <>
              <m.path d={`M${right},${BASE} ${greens.map((x) => beat(x)).join(" ")} L${w - 24},${BASE}`} fill="none" stroke="var(--recovered)" strokeWidth="2" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: "easeInOut" }} />
              <m.text x={w - 24} y={BASE + 34} textAnchor="end" className="fill-recovered text-[12px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
                the gift comes back
              </m.text>
            </>
          ) : (
            <>
              <path d={`M${right},${BASE} L${w - 24},${BASE}`} fill="none" stroke="var(--ink-muted)" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 6" />
              <text x={w - 24} y={BASE + 34} textAnchor="end" className="fill-ink-muted text-[12px]">
                waiting for your approval
              </text>
            </>
          )}
        </svg>
      ) : null}
      <div className="absolute top-0 -translate-x-1/2" style={{ left: card.cx || "60%" }}>
        <HeroAgent onSentChange={setSent} />
      </div>
    </div>
  );
}
