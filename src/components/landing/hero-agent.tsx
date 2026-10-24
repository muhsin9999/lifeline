"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Check, Mail, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AgentAvatar, type AgentMood } from "@/components/brand/agent-avatar";
import { cn } from "@/lib/utils";

// The hero's agent card: a replay of the first real rescue on the live sandbox. Cora's $1 test gift failed with
// PAYER_CANNOT_PAY; the agent read PayPal, recommended a note, Tunde approved it and the email went out. The steps
// are that rescue's real tool calls, in plain words.
const STEPS = ["Read Cora's PayPal subscription", "Checked the failed payment", "Looked at her past gifts", "Drafted a note to Cora"];
const STEP_MS = 1100;

type Phase = { step: number; fix: boolean; sent: boolean };

// `onSentChange` tells the page when the note goes out (and when a replay resets it), so the heartbeat around the
// card can come back to life.
export function HeroAgent({ onSentChange }: { onSentChange?: (sent: boolean) => void }) {
  const reduce = useReducedMotion();
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<Phase>({ step: 0, fix: false, sent: false });
  const [gaze, setGaze] = useState<{ x: number; y: number } | undefined>();
  const face = useRef<HTMLDivElement>(null);

  // Plays the rescue once per run: each step works, then ticks; then the fix card arrives and waits for Approve.
  useEffect(() => {
    if (reduce) {
      const t = setTimeout(() => setPhase({ step: STEPS.length, fix: true, sent: false }), 0);
      return () => clearTimeout(t);
    }
    const timers = STEPS.map((_, i) => setTimeout(() => setPhase((p) => ({ ...p, step: i + 1 })), 900 + STEP_MS * (i + 1)));
    timers.push(setTimeout(() => setPhase((p) => ({ ...p, fix: true })), 900 + STEP_MS * (STEPS.length + 1)));
    return () => timers.forEach(clearTimeout);
  }, [run, reduce]);

  // The eyes follow the cursor anywhere on the page.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const r = face.current?.getBoundingClientRect();
      if (!r) return;
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const k = Math.min(1, Math.hypot(dx, dy) / 400);
      const a = Math.atan2(dy, dx);
      setGaze({ x: Math.cos(a) * 6 * k, y: Math.sin(a) * 3 * k });
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const working = phase.step < STEPS.length;
  const mood: AgentMood = phase.sent ? "happy" : working ? "working" : phase.fix ? "idle" : "thinking";

  return (
    <div className="relative w-full max-w-[380px] sm:w-[380px]">
      <div aria-hidden className="absolute inset-x-10 top-16 h-48 rounded-full bg-brand/15 blur-3xl" />
      <div className="relative rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgb(26_20_20/0.05),0_24px_60px_-12px_rgb(26_20_20/0.18)]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Lifeline AI</span>
          <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] text-ink-muted">PayPal · Sandbox</span>
        </div>

        <div ref={face} className="relative mx-auto mt-1 grid size-32 place-items-center">
          <div aria-hidden className="absolute inset-4 rounded-full bg-brand/25 blur-2xl" />
          <AgentAvatar glossy mood={mood} gaze={working ? undefined : gaze} milestone={phase.sent ? "sent" : "done"} className="relative size-28" />
        </div>

        <ol className="mt-4 space-y-2.5" aria-label="What Lifeline checked">
          {STEPS.map((s, i) => {
            const done = phase.step > i;
            const active = phase.step === i;
            return (
              <m.li key={s} initial={false} animate={{ opacity: done || active ? 1 : 0.35 }} className="flex items-center gap-3 text-[15px]">
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full transition-colors", done ? "bg-recovered-tint text-recovered" : "bg-paper")}>
                  {done ? <Check className="size-3.5" strokeWidth={3} /> : active ? <span className="size-2 animate-pulse rounded-full bg-ink-muted" /> : null}
                </span>
                <span className={cn(done ? "text-ink" : active ? "shimmer-text" : "text-ink-muted")}>{s}</span>
              </m.li>
            );
          })}
        </ol>

        <div className="mt-5 min-h-[164px]">
          <AnimatePresence mode="wait">
            {phase.fix ? (
              <m.div key="fix" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="rounded-xl border border-line bg-paper/60 p-4">
                <div className="flex gap-3">
                  <Mail className="mt-0.5 size-4 shrink-0 text-ink-muted" />
                  <div>
                    <p className="text-[15px] font-semibold text-ink">Send Cora a note</p>
                    <p className="mt-1 text-sm leading-snug text-ink-muted">PayPal couldn&apos;t charge her account. Her gift is still on, so a quick nudge should bring it back.</p>
                  </div>
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  {phase.sent ? (
                    <m.div key="sent" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 flex h-11 items-center justify-center gap-2 rounded-lg bg-recovered-tint text-sm font-semibold text-recovered">
                      <Check className="size-4" strokeWidth={3} /> Note sent to Cora
                    </m.div>
                  ) : (
                    <m.button key="approve" type="button" whileTap={{ scale: 0.98 }} onClick={() => {
                        setPhase((p) => ({ ...p, sent: true }));
                        onSentChange?.(true);
                      }} className="mt-4 h-11 w-full rounded-lg bg-brand text-sm font-semibold text-white transition-colors hover:bg-brand-strong">
                      Approve
                    </m.button>
                  )}
                </AnimatePresence>
              </m.div>
            ) : (
              <m.p key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-6 text-center text-sm text-ink-muted">
                {working ? "Looking into Cora's failed gift…" : "Choosing the kindest fix…"}
              </m.p>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between px-1 text-xs text-ink-muted">
        <span>Replay of a real rescue in our PayPal sandbox</span>
        <button type="button" onClick={() => {
            setPhase({ step: 0, fix: false, sent: false });
            onSentChange?.(false);
            setRun((r) => r + 1);
          }} className="inline-flex items-center gap-1 rounded hover:text-ink">
          <RotateCcw className="size-3" /> Replay
        </button>
      </div>
    </div>
  );
}
