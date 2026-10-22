"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { m } from "motion/react";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Pulse } from "@/server/queries";

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];
const H = 168;
const BASE = 92;
const UP = 70;
const DOWN = 56;

type Day = { key: string; date: Date; given: number; recovered: number; failed: number; open: number; entries: { donor: string; cents: number; kind: "given" | "recovered" | "failed" }[] };

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const fmtDay = (d: Date) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d);

function bucket(p: Pulse, range: Range): Day[] {
  const to = new Date(p.to);
  const days: Day[] = [];
  for (let i = range - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() - i));
    days.push({ key: dayKey(date), date, given: 0, recovered: 0, failed: 0, open: 0, entries: [] });
  }
  const byKey = new Map(days.map((d) => [d.key, d]));
  for (const g of p.gifts) {
    const d = byKey.get(g.at.slice(0, 10));
    if (!d) continue;
    if (g.recovered) d.recovered += g.cents;
    else d.given += g.cents;
    d.entries.push({ donor: g.donor, cents: g.cents, kind: g.recovered ? "recovered" : "given" });
  }
  for (const f of p.failures) {
    const d = byKey.get(f.at.slice(0, 10));
    if (!d) continue;
    d.failed += f.cents;
    if (["new", "diagnosing", "awaiting_approval", "acting"].includes(f.status)) d.open += 1;
    d.entries.push({ donor: f.donor, cents: f.cents, kind: "failed" });
  }
  return days;
}

/** An ECG-style beat at x: a small dip, the spike, a small rebound, back to the baseline. */
const beatUp = (x: number, w: number, h: number) => `M${x - w / 2},${BASE} L${x - w / 4},${BASE + 3} L${x},${BASE - h} L${x + w / 4},${BASE + Math.min(10, h / 4)} L${x + w / 2},${BASE}`;
const beatDown = (x: number, w: number, h: number) => `M${x - w / 2},${BASE} L${x - w / 5},${BASE - 4} L${x},${BASE + h} L${x + w / 5},${BASE - 3} L${x + w / 2},${BASE}`;

/**
 * The giving pulse: every beat is a day's real monthly gifts (height = amount), a coral dip below the line is a
 * gift that failed, and a sage beat is a gift Lifeline recovered. Hover any day for who and how much.
 */
export function GivingPulse({ pulse }: { pulse: Pulse }) {
  const [range, setRange] = useState<Range>(30);
  const [hover, setHover] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const days = useMemo(() => bucket(pulse, range), [pulse, range]);
  const max = Math.max(1, ...days.map((d) => Math.max(d.given, d.recovered, d.failed)));
  const step = width / days.length;
  const w = Math.min(22, Math.max(6, step * 0.9));
  const scale = (cents: number, room: number) => (cents ? 10 + Math.sqrt(cents / max) * (room - 10) : 0);
  const xOf = (i: number) => step * i + step / 2;

  const line = `M0,${BASE} ` + days.map((d, i) => (d.given ? beatUp(xOf(i), w, scale(d.given, UP)).replace(/^M/, "L") : "")).join(" ") + ` L${width},${BASE}`;
  const totals = days.reduce((t, d) => ({ given: t.given + d.given, recovered: t.recovered + d.recovered, failed: t.failed + (d.failed ? d.entries.filter((e) => e.kind === "failed").length : 0) }), { given: 0, recovered: 0, failed: 0 });
  const ticks = days.map((d, i) => ({ d, i })).filter(({ i }) => i % Math.ceil(days.length / 6) === 0 || i === days.length - 1);
  const active = hover !== null ? days[hover] : null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Giving pulse</h2>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {money(totals.given + totals.recovered)} given · {totals.failed} failed · <span className="text-recovered">{money(totals.recovered)} recovered</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Legend />
          <div role="tablist" aria-label="Time range" className="flex rounded-lg bg-muted p-0.5">
            {RANGES.map((r) => (
              <button key={r} role="tab" aria-selected={range === r} onClick={() => setRange(r)} className={cn("h-7 rounded-md px-2.5 text-xs tabular-nums text-ink-muted", range === r && "bg-surface font-medium text-ink shadow-sm")}>
                {r}d
              </button>
            ))}
          </div>
        </div>
      </div>

      <div ref={wrap} className="relative mt-4" onMouseLeave={() => setHover(null)}>
        <svg width={width} height={H + 22} className="block overflow-visible" role="img" aria-label={`Giving pulse, last ${range} days`}>
          <line x1={0} x2={width} y1={BASE} y2={BASE} stroke="var(--line)" />
          {active ? <line x1={xOf(hover!)} x2={xOf(hover!)} y1={8} y2={H} stroke="var(--line)" /> : null}
          <m.path key={`line-${range}`} d={line} fill="none" stroke="var(--ink-muted)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: "easeInOut" }} />
          {days.map((d, i) =>
            d.recovered ? (
              <m.g key={`r-${range}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + (i / days.length) * 1.2 }}>
                <path d={beatUp(xOf(i), w, scale(d.recovered, UP))} fill="none" stroke="var(--recovered)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={xOf(i)} cy={BASE - scale(d.recovered, UP) - 7} r={4} fill="var(--recovered)" stroke="var(--surface)" strokeWidth={2} />
              </m.g>
            ) : null,
          )}
          {days.map((d, i) =>
            d.failed ? (
              <m.g key={`f-${range}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + (i / days.length) * 1.2 }}>
                <path d={beatDown(xOf(i) + (d.given ? w * 0.55 : 0), w * 0.8, scale(d.failed, DOWN))} fill="none" stroke="var(--brand)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {d.open ? <circle cx={xOf(i) + (d.given ? w * 0.55 : 0)} cy={BASE + scale(d.failed, DOWN) + 7} r={4} fill="var(--brand)" stroke="var(--surface)" strokeWidth={2} /> : null}
              </m.g>
            ) : null,
          )}
          {ticks.map(({ d, i }) => (
            <text key={d.key} x={xOf(i)} y={H + 16} textAnchor="middle" className="fill-muted-foreground text-[11px] tabular-nums">
              {fmtDay(d.date)}
            </text>
          ))}
          {days.map((d, i) => (
            <rect key={`hit-${d.key}`} x={step * i} y={0} width={step} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>
        {active ? <Tip day={active} x={xOf(hover!)} width={width} /> : null}
      </div>
    </section>
  );
}

function Legend() {
  return (
    <ul className="hidden items-center gap-3 text-xs text-ink-muted sm:flex">
      <li className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-ink-muted" />Given</li>
      <li className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-brand" />Failed</li>
      <li className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-recovered" />Recovered</li>
    </ul>
  );
}

const KIND = { given: "gave", recovered: "recovered", failed: "failed" } as const;
const DOT = { given: "bg-ink-muted", recovered: "bg-recovered", failed: "bg-brand" } as const;

function Tip({ day, x, width }: { day: Day; x: number; width: number }) {
  const left = Math.min(Math.max(x - 110, 0), width - 220);
  return (
    <div className="pointer-events-none absolute top-0 z-10 w-[220px] rounded-xl border border-line bg-surface p-3 text-xs shadow-soft" style={{ left }}>
      <p className="font-medium">{fmtDay(day.date)}</p>
      {day.entries.length ? (
        <ul className="mt-1.5 space-y-1">
          {day.entries.slice(0, 6).map((e, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className={cn("size-1.5 shrink-0 rounded-full", DOT[e.kind])} />
              <span className="min-w-0 flex-1 truncate">{e.donor}</span>
              <span className="tabular-nums text-ink-muted">{KIND[e.kind]} {money(e.cents)}</span>
            </li>
          ))}
          {day.entries.length > 6 ? <li className="text-ink-muted">+{day.entries.length - 6} more</li> : null}
        </ul>
      ) : (
        <p className="mt-1 text-ink-muted">No gifts due</p>
      )}
    </div>
  );
}
