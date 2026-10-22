"use client";

import { m, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Lifeline's agent: a white rounded body with a black visor across the eyes, and soft glowing eyes inside it.
// Only the eyes act, and they follow what the agent is really doing (a rescue's status maps to a mood), so the
// face is never decoration on its own.
export type AgentMood = "idle" | "working" | "thinking" | "worried" | "happy";

const EYE = "var(--agent-eye)";

type Gaze = { x: number; y: number };
const LOOKS: Record<Exclude<AgentMood, "happy">, Gaze[]> = {
  idle: [{ x: 0, y: 0 }, { x: -5, y: 0 }, { x: 5, y: -1 }, { x: 0, y: 0 }, { x: 3, y: 1 }],
  working: [{ x: -6, y: 1 }, { x: 6, y: 1 }],
  thinking: [{ x: 4, y: -2 }, { x: -3, y: -2 }, { x: 5, y: -2 }],
  worried: [{ x: 0, y: 1 }],
};
const PACE: Record<AgentMood, number> = { idle: 1800, working: 700, thinking: 1500, worried: 4000, happy: 4000 };

/**
 * Counts the moments `signal` turns on (or changes to a new truthy value) while the component is mounted.
 * It is 0 on first render, so something already finished when a page opens doesn't celebrate again; only
 * finishing in front of the viewer does.
 */
export function useCelebration(signal: boolean | string) {
  const [prev, setPrev] = useState(signal);
  const [count, setCount] = useState(0);
  if (signal !== prev) {
    setPrev(signal);
    if (signal) setCount((c) => c + 1);
  }
  return count;
}

/** One coral heartbeat ring that pulses out and fades, around whatever it sits on. Re-key it to play again. */
export function PulseRing({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={cn("pointer-events-none absolute inset-0 size-full overflow-visible", className)}>
      {[0, 0.18].map((delay) => (
        <m.circle
          key={delay}
          cx="50" cy="50" r="50"
          fill="none" stroke="var(--brand)" strokeWidth="3"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: [0.9, 1.35, 1.6], opacity: [0, 0.9, 0] }}
          transition={{ duration: 0.9, delay, ease: "easeOut" }}
          style={{ transformOrigin: "50px 50px" }}
        />
      ))}
    </svg>
  );
}

// `calm` is for lists: the eyes drift less, wait several seconds between moves and each copy keeps its own
// timing, so a column of faces never moves in step or pulls the eye away from the text.
// `milestone` names what was just finished (e.g. "diagnosed", "recovered"): reaching a new one celebrates again.
export function AgentAvatar({ mood = "idle", className, still = false, calm = false, label = "Lifeline AI", milestone = "done" }: { mood?: AgentMood; className?: string; still?: boolean; calm?: boolean; label?: string; milestone?: string }) {
  const reduce = useReducedMotion();
  const moving = !still && !reduce;
  const [look, setLook] = useState(0);
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (!moving || mood === "happy") return;
    if (!calm) {
      const t = setInterval(() => setLook((i) => i + 1), PACE[mood]);
      return () => clearInterval(t);
    }
    let t: ReturnType<typeof setTimeout>;
    const next = (first: boolean) => {
      t = setTimeout(() => {
        setLook((i) => i + 1);
        next(false);
      }, (first ? 2500 : 5000) + Math.random() * 5000);
    };
    next(true);
    return () => clearTimeout(t);
  }, [moving, mood, calm]);
  useEffect(() => {
    if (!moving || mood === "happy" || mood === "thinking") return;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 120);
        next();
      }, calm ? 6000 + Math.random() * 8000 : 2600 + Math.random() * 2400);
    };
    next();
    return () => clearTimeout(t);
  }, [moving, mood, calm]);

  const celebrated = useCelebration(mood === "happy" && milestone);
  const looks = mood === "happy" ? [{ x: 0, y: 0 }] : LOOKS[mood];
  const raw = moving ? looks[look % looks.length] : { x: 0, y: 0 };
  const gaze = calm ? { x: raw.x * 0.5, y: raw.y * 0.5 } : raw;

  return (
    <span role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true} className={cn("relative inline-grid shrink-0 place-items-center", className)}>
      {celebrated && !calm ? <PulseRing key={celebrated} /> : null}
      <svg viewBox="0 0 100 100" className="size-full overflow-visible">
        <defs>
          <filter id="lifeline-eye-glow" filterUnits="userSpaceOnUse" x="10" y="25" width="80" height="50">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <m.g key={`hop-${celebrated}`} animate={celebrated && !reduce ? { y: [0, -8, 0, -2, 0] } : { y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }}>
          <m.g animate={moving && mood === "working" ? { y: [0, -1.5, 0] } : { y: 0 }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
            {/* Body: a white rounded shell with a hairline edge, so it reads on paper and on white cards. */}
            <circle cx="50" cy="50" r="48" fill="var(--agent-shell)" stroke="#e3dcd2" strokeWidth="1.5" />
            <circle cx="50" cy="51.5" r="46" fill="none" stroke="#000" strokeOpacity="0.04" strokeWidth="3" />
            {/* Visor: black only where the eyes are. */}
            <rect x="17" y="33" width="66" height="34" rx="17" fill="var(--agent-visor)" />
            <rect x="22" y="36" width="34" height="6" rx="3" fill="#fff" opacity="0.07" />
            <m.g initial={false} animate={gaze} transition={calm ? { type: "spring", stiffness: 60, damping: 16 } : { type: "spring", stiffness: 200, damping: 20 }} filter="url(#lifeline-eye-glow)">
              <Eyes mood={mood} blink={blink} />
            </m.g>
          </m.g>
        </m.g>
      </svg>
    </span>
  );
}

function Eyes({ mood, blink }: { mood: AgentMood; blink: boolean }) {
  const stroke = { fill: "none", stroke: EYE, strokeWidth: 5, strokeLinecap: "round" as const };
  if (mood === "happy")
    return (
      <g {...stroke}>
        <path d="M33 54 Q39 44 45 54" />
        <path d="M55 54 Q61 44 67 54" />
      </g>
    );
  if (mood === "worried")
    return (
      <g {...stroke}>
        <path d="M33 48 Q39 55 45 51" />
        <path d="M55 51 Q61 55 67 48" />
      </g>
    );
  if (mood === "thinking")
    return (
      <g {...stroke}>
        <path d="M34 50 H44" />
        <path d="M56 50 H66" />
      </g>
    );
  return (
    <g fill={EYE}>
      {[39, 61].map((cx) => (
        <m.rect key={cx} x={cx - 4.5} width="9" rx="4.5" initial={false} animate={{ y: blink ? 49 : 43, height: blink ? 2 : 14 }} transition={{ duration: blink ? 0.05 : 0.15 }} />
      ))}
    </g>
  );
}
