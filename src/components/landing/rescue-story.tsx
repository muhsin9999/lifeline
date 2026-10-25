"use client";

import { m, useInView } from "motion/react";
import { Check, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AgentAvatar } from "@/components/brand/agent-avatar";
import { cn } from "@/lib/utils";

// "How it works" as three frames on one heartbeat: the gift fails (coral), Lifeline plans a fix you approve,
// the gift comes back (sage). The line draws itself when the section scrolls into view.
const BEAT = "M0 30 H22 l5 -8 l6 22 l7 -36 l6 30 l4 -8 H100";

function Segment({ tone, delay, on }: { tone: "fail" | "plan" | "ok"; delay: number; on: boolean }) {
  const stroke = tone === "fail" ? "var(--brand)" : tone === "ok" ? "var(--recovered)" : "var(--line)";
  return (
    <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden className="h-16 w-full min-w-10">
      <m.path d={BEAT} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={on ? { pathLength: 1 } : {}} transition={{ duration: 0.7, delay, ease: "easeInOut" }} />
    </svg>
  );
}

// From md up the three frames sit in a row and play in turn; stacked on a phone, each plays as it reaches the screen.
function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(min-width: 768px)");
    const set = () => setWide(q.matches);
    set();
    q.addEventListener("change", set);
    return () => q.removeEventListener("change", set);
  }, []);
  return wide;
}

function Frame({ on, delay, children, className }: { on: boolean; delay: number; children: React.ReactNode; className?: string }) {
  return (
    <m.div initial={{ opacity: 0, y: 14 }} animate={on ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.45, delay }} className={cn("w-full rounded-2xl border border-line bg-surface p-5 shadow-soft md:flex md:min-h-28 md:flex-col md:justify-center", className)}>
      {children}
    </m.div>
  );
}

// The section title and its Replay sit here so Replay can restart the strip (a new key remounts it).
export function RescueStory() {
  const [run, setRun] = useState(0);
  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-8">
        <h2 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">How a rescue works</h2>
        <p className="mx-auto mt-3 max-w-md text-ink-muted">From a failed payment to a donor still giving, with you approving every step.</p>
        <button type="button" onClick={() => setRun((r) => r + 1)} className="mt-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <RotateCcw className="size-3.5" /> Replay
        </button>
      </div>
      <div className="mt-12">
        <Strip key={run} />
      </div>
    </div>
  );
}

function Strip() {
  const ref = useRef<HTMLDivElement>(null);
  const wide = useWide();
  const strip = useInView(ref, { once: true, margin: "-120px" });
  const r0 = useRef<HTMLDivElement>(null);
  const r1 = useRef<HTMLDivElement>(null);
  const r2 = useRef<HTMLDivElement>(null);
  const own = [useInView(r0, { once: true, amount: 0.6 }), useInView(r1, { once: true, amount: 0.6 }), useInView(r2, { once: true, amount: 0.6 })];
  const rowRefs = [r0, r1, r2];
  // Row: one trigger, staggered. Stacked: each card on its own, with a short lead-in.
  const onAt = (i: number) => (wide ? strip : own[i]);
  const delayAt = (i: number) => (wide ? 0.5 + i : 0.35);
  const on = onAt(1);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!on) return;
    const t = setTimeout(() => setSaved(true), wide ? 2300 : 1300);
    return () => clearTimeout(t);
  }, [on, wide]);

  const steps = [
    ["Spot", "PayPal tells Lifeline the moment a monthly gift fails. Every message is signature-checked."],
    ["Fix", "The AI reads PayPal, works out why, and suggests one fix. Nothing happens until you approve."],
    ["Recover", "Lifeline makes the change in PayPal and watches until the gift comes back."],
  ];
  const cards = [
    <Frame key="fail" on={onAt(0)} delay={delayAt(0)}>
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full bg-brand" />
        <span className="font-semibold text-ink">Gift failed</span>
      </div>
      <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-sm text-ink-muted">Monthly gift · PayPal</p>
    </Frame>,
    <Frame key="plan" on={onAt(1)} delay={delayAt(1)}>
      <div className="flex items-center gap-3">
        <AgentAvatar glossy mood={saved ? "happy" : on ? "thinking" : "idle"} milestone="saved" className="size-12 shrink-0" label="" />
        <div className="min-w-0">
          <span className="font-semibold text-ink">Lifeline&apos;s plan</span>
          <p className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-recovered-tint px-2.5 py-1 text-xs whitespace-nowrap text-recovered">
            <Check className="size-3" strokeWidth={3} /> You approve one fix
          </p>
        </div>
      </div>
    </Frame>,
    <Frame key="ok" on={onAt(2)} delay={delayAt(2)}>
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full bg-recovered" />
        <span className="font-semibold text-ink">Gift recovered</span>
      </div>
      <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-sm text-ink-muted">PayPal charges again</p>
    </Frame>,
  ];
  const tones = ["fail", "plan", "ok", "ok"] as const;

  return (
    <div ref={ref} data-flow="story" data-flow-y={56} className="flex flex-col items-center gap-10 px-4 md:flex-row md:items-start md:gap-0 md:px-6 lg:px-12">
      {cards.map((card, i) => (
        <div key={i} className="contents">
          <div className="hidden flex-1 pt-6 md:block">
            <Segment tone={tones[i]} delay={i} on={strip} />
          </div>
          <div ref={rowRefs[i]} className="flex w-full max-w-72 flex-col items-center md:w-64 md:shrink-0">
            <div className="-mt-4 mb-2 w-40 md:hidden">
              <Segment tone={tones[i]} delay={0} on={own[i]} />
            </div>
            {card}
            <p className="mt-6 font-semibold text-ink">
              <span className="text-ink-muted tabular-nums">{i + 1}.</span> {steps[i][0]}
            </p>
            <p className="mt-1.5 text-center text-sm leading-relaxed text-ink-muted">{steps[i][1]}</p>
          </div>
        </div>
      ))}
      <div className="hidden flex-1 pt-6 md:block">
        <Segment tone="ok" delay={3} on={strip} />
      </div>
    </div>
  );
}
