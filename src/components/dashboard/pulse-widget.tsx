"use client";

// A custom AG Studio widget: the giving pulse. It asks Studio for one row per day (through the shared calendar),
// with the amount given and the amount that failed, and draws them as a heartbeat: a beat up for gifts, a coral
// dip for failures. Page and cross filters apply, because the data comes from Studio's own query.
import { useEffect, useRef, useState } from "react";
import type { AgWidgetDataFormat, AgWidgetFieldReference, AgWidgetParams } from "ag-studio";

export interface PulseWidgetDef {
  type: "giving-pulse";
  dataMapping: { day: AgWidgetFieldReference[]; given: AgWidgetFieldReference[]; failed?: AgWidgetFieldReference[] };
  format?: AgWidgetDataFormat<Record<string, never>>;
}

type Beat = { t: number; given: number; failed: number };
const W = 1000;
const H = 140;
const BASE = 78;
const DAY = 86_400_000;
const LONGEST = 60 * DAY; // the strip ends today and reaches back to the first gift, between 14 and 60 days
const SHORTEST = 14 * DAY;

export function PulseWidget({ dataMapping, widgetApi }: AgWidgetParams<PulseWidgetDef>) {
  const [beats, setBeats] = useState<Beat[] | null>(null);
  const [win, setWin] = useState({ from: 0, to: 1 });
  const loaded = useRef(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const day = dataMapping.day?.at(0);
      const given = dataMapping.given?.at(0);
      const failed = dataMapping.failed?.at(0);
      if (!day || !given) {
        widgetApi.setDisplayState("incompleteDataMapping");
        return;
      }
      widgetApi.setDisplayState("loading", { prominent: !loaded.current });
      // One query per measure, each with its own queryId (a second query under the same id supersedes the first). Asked together, a measure from another table comes back as its grand total on
      // every day instead of per day. Studio returns a calendar day as a yyyymmdd number.
      const [g, f] = await Promise.all([widgetApi.getData({ fields: [day, given] }, { queryId: "given" }), failed ? widgetApi.getData({ fields: [day, failed] }, { queryId: "failed" }) : null]);
      if (!live) return;
      const byDay = new Map<number, Beat>();
      const at = (v: unknown) => {
        const n = Number(v);
        const t = Number.isInteger(n) && n > 19000101 && n < 30000101 ? Date.UTC(Math.floor(n / 10000), Math.floor((n % 10000) / 100) - 1, n % 100) : new Date(v as string).getTime();
        if (!Number.isFinite(t)) return null;
        if (!byDay.has(t)) byDay.set(t, { t, given: 0, failed: 0 });
        return byDay.get(t)!;
      };
      for (const r of g.results.rows as Record<string, unknown>[]) {
        const b = at(r[day.key]);
        if (b) b.given += Number(r[given.key] ?? 0);
      }
      for (const r of (f?.results.rows ?? []) as Record<string, unknown>[]) {
        const b = at(r[day.key]);
        if (b) b.failed += Number(r[failed!.key] ?? 0);
      }
      // The strip fits the data: from the first gift (at most 60 days back, at least 14) to today, so a young
      // account's few beats aren't squeezed into one corner.
      const all = [...byDay.values()].sort((a, b) => a.t - b.t);
      const now = Date.now();
      const first = all.find((b) => b.given || b.failed)?.t ?? now;
      const cutoff = Math.max(now - LONGEST, Math.min(first - DAY, now - SHORTEST));
      setWin({ from: cutoff, to: now });
      const rows = all.filter((b) => b.t >= cutoff);
      loaded.current = true;
      setBeats(rows);
      widgetApi.setDisplayState(rows.length ? "displayed" : "noData");
    })().catch(() => widgetApi.setDisplayState("noData"));
    return () => {
      live = false;
    };
  }, [dataMapping, widgetApi]);

  if (!beats?.length) return null;
  const t0 = win.from;
  const span = win.to - win.from;
  const max = Math.max(1, ...beats.map((b) => Math.max(b.given, b.failed)));
  const x = (t: number) => 20 + ((t - t0) / span) * (W - 40);
  const h = (v: number, room: number) => (v ? 8 + Math.sqrt(v / max) * (room - 8) : 0);
  const w = 12;
  const up = beats
    .filter((b) => b.given)
    .map((b) => `L${x(b.t) - w / 2},${BASE} L${x(b.t) - w / 4},${BASE + 3} L${x(b.t)},${BASE - h(b.given, 64)} L${x(b.t) + w / 4},${BASE + 8} L${x(b.t) + w / 2},${BASE}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }} role="img" aria-label="Giving pulse: gifts and failed gifts per day">
      <line x1={0} x2={W} y1={BASE} y2={BASE} stroke="#e7e1d8" />
      <path d={`M0,${BASE} ${up} L${W},${BASE}`} fill="none" stroke="#6b625c" strokeWidth={1.75} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {beats
        .filter((b) => b.failed)
        .map((b) => (
          <path key={b.t} d={`M${x(b.t) - w / 2},${BASE} L${x(b.t)},${BASE + h(b.failed, 52)} L${x(b.t) + w / 2},${BASE}`} fill="none" stroke="#e5484d" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ))}
    </svg>
  );
}
