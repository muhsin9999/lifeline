"use client";

import { m, useInView } from "motion/react";
import { Check } from "lucide-react";
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

function Frame({ on, delay, children, className }: { on: boolean; delay: number; children: React.ReactNode; className?: string }) {
  return (
    <m.div initial={{ opacity: 0, y: 14 }} animate={on ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.45, delay }} className={cn("w-full rounded-2xl border border-line bg-surface p-5 shadow-soft", className)}>
      {children}
    </m.div>
  );
}

export function RescueStory() {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref, { once: true, margin: "-120px" });
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!on) return;
    const t = setTimeout(() => setSaved(true), 2300);
    return () => clearTimeout(t);
  }, [on]);

  const steps = [
    ["Spot", "PayPal tells Lifeline the moment a monthly gift fails. Every message is signature-checked."],
    ["Fix", "The AI reads PayPal, works out why, and suggests one fix. Nothing happens until you approve."],
    ["Recover", "Lifeline makes the change in PayPal and watches until the gift comes back."],
  ];
  const cards = [
    <Frame key="fail" on={on} delay={0.5}>
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full bg-brand" />
        <span className="font-semibold text-ink">Gift failed</span>
      </div>
      <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-sm text-ink-muted">Monthly gift · PayPal</p>
    </Frame>,
    <Frame key="plan" on={on} delay={1.5} className="text-center">
      <span className="font-semibold text-ink">Lifeline&apos;s plan</span>
      <div className="mx-auto mt-2 grid size-20 place-items-center">
        <AgentAvatar glossy mood={saved ? "happy" : on ? "thinking" : "idle"} milestone="saved" className="size-18" label="" />
      </div>
      <p className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-paper px-3 py-2 text-sm text-ink">
        <Check className="size-3.5 text-recovered" strokeWidth={3} /> You approve one fix
      </p>
    </Frame>,
    <Frame key="ok" on={on} delay={2.5}>
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full bg-recovered" />
        <span className="font-semibold text-ink">Gift recovered</span>
      </div>
      <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-sm text-ink-muted">PayPal charges again</p>
    </Frame>,
  ];
  const tones = ["fail", "plan", "ok", "ok"] as const;

  return (
    <div ref={ref} className="flex flex-col items-center gap-10 md:flex-row md:items-start md:gap-0">
      {cards.map((card, i) => (
        <div key={i} className="contents">
          <div className="hidden flex-1 pt-8 md:block">
            <Segment tone={tones[i]} delay={i} on={on} />
          </div>
          <div className="flex w-full max-w-72 flex-col items-center md:w-60 md:shrink-0">
            {card}
            <p className="mt-6 font-semibold text-ink">
              <span className="text-ink-muted tabular-nums">{i + 1}.</span> {steps[i][0]}
            </p>
            <p className="mt-1.5 text-center text-sm leading-relaxed text-ink-muted">{steps[i][1]}</p>
          </div>
        </div>
      ))}
      <div className="hidden flex-1 pt-8 md:block">
        <Segment tone="ok" delay={3} on={on} />
      </div>
    </div>
  );
}
