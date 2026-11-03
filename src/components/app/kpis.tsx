import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Kpis } from "@/server/queries";

/** The four numbers a fundraising officer checks first, each with the context that makes it mean something. */
export function KpiRow({ k }: { k: Kpis }) {
  const rate = k.recoveryRate.all ? Math.round((k.recoveryRate.recovered / k.recoveryRate.all) * 100) : null;
  const delta = k.recovered.cents - k.recovered.lastMonthCents;
  const tiles = [
    { label: "Regular giving", value: money(k.monthlyGiving.cents), sub: `${k.monthlyGiving.donors} active ${k.monthlyGiving.donors === 1 ? "donor" : "donors"}` },
    { label: "At risk", value: money(k.atRisk.cents), sub: k.atRisk.count ? `${k.atRisk.count} failed ${k.atRisk.count === 1 ? "gift" : "gifts"} to rescue` : "Nothing failing", tone: k.atRisk.count ? "risk" : undefined },
    {
      label: "Recovered this month",
      value: money(k.recovered.cents),
      sub: k.recovered.lastMonthCents || k.recovered.cents ? `${delta >= 0 ? "+" : "−"}${money(Math.abs(delta))} vs last month` : "Nothing to recover yet",
      tone: k.recovered.cents ? "good" : undefined,
    },
    { label: "Recovery rate", value: rate === null ? "—" : `${rate}%`, sub: k.recoveryRate.all ? `${k.recoveryRate.recovered} of ${k.recoveryRate.all} failures, last 90 days` : "No failures in 90 days" },
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-soft">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {"tone" in t && t.tone ? <span className={cn("size-1.5 rounded-full", t.tone === "risk" ? "bg-brand" : "bg-recovered")} /> : null}
            {t.label}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{t.value}</p>
          <p className="mt-0.5 text-xs text-pretty text-muted-foreground tabular-nums">{t.sub}</p>
        </div>
      ))}
    </div>
  );
}
