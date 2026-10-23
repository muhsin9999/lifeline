import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ChevronRightIcon } from "lucide-react";
import { ChatRail } from "@/components/app/chat-rail";
import { GivingPulse } from "@/components/app/giving-pulse";
import { KpiRow } from "@/components/app/kpis";
import { AgentAvatar } from "@/components/brand/agent-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { money } from "@/lib/format";
import { causeLabel, timeAgo } from "@/lib/labels";
import { currentOrg, getKpis, getNeedsYou, getPulse, getRecentlyClosed } from "@/server/queries";

export const metadata = { title: "Rescues" };

export default function RescuesPage() {
  return (
    <Suspense fallback={<RescuesSkeleton />}>
      <Rescues />
    </Suspense>
  );
}

async function Rescues() {
  await connection();
  const now = new Date();
  const org = await currentOrg();
  const [kpis, pulse, needs, closed] = await Promise.all([getKpis(org.id, now), getPulse(org.id, now, 90), getNeedsYou(org.id), getRecentlyClosed(org.id)]);
  const ready = needs.filter((f) => f.status === "awaiting_approval" && !f.error);
  const fallback = needs.filter((f) => f.status === "awaiting_approval" && f.error);
  const hour = now.getUTCHours() + 1; // Tunde works on West Africa Time
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const brief = needs.length
    ? `${greeting}, Tunde. ${needs.length} monthly ${needs.length === 1 ? "gift needs" : "gifts need"} you, ${money(kpis.atRisk.cents)} a month at risk.${ready.length ? ` I've looked into ${ready.length}; ${ready.length === 1 ? "a fix is" : "fixes are"} ready.` : ""}${fallback.length ? ` I couldn't finish ${fallback.length === 1 ? "one" : fallback.length}, so standard fixes are waiting.` : ""}`
    : `${greeting}, Tunde. Every monthly gift went through. I'll tell you the moment one fails.`;

  return (
    <>
      <main className="min-w-0 flex-1 px-6 py-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-5">
          <KpiRow k={kpis} />
          <GivingPulse pulse={pulse} />
          <section className="rounded-2xl border border-line bg-surface shadow-soft">
            <header className="flex items-baseline justify-between px-5 pt-4 pb-2">
              <h2 className="text-sm font-semibold">Needs you</h2>
              <span className="text-xs text-muted-foreground">{needs.length ? `${needs.length} open` : "All clear"}</span>
            </header>
            <ul className="divide-y divide-line">
              {needs.map((f) => (
                <li key={f.id}>
                  <Link href={`/rescues/${f.id}`} className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 px-5 py-3 hover:bg-paper/60 sm:grid-cols-[2.25rem_minmax(0,1.4fr)_minmax(0,1fr)_auto_auto]">
                    <Initials name={f.donor.name} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{f.donor.name}</span>
                      <span className="block text-xs text-muted-foreground tabular-nums">Monthly gift · {money(f.donor.amountCents)}</span>
                    </span>
                    <span className="hidden sm:block">
                      <span className="rounded-full bg-brand-tint px-2 py-0.5 text-xs text-brand-strong">{causeLabel(f.reasonCode)}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{timeAgo(f.failedAt, now)}</span>
                    </span>
                    <span className="hidden items-center gap-2 text-xs sm:flex">
                      <AgentAvatar calm mood={f.status === "awaiting_approval" ? (f.error ? "worried" : "happy") : "working"} className="size-6" label="" />
                      {f.status === "awaiting_approval" ? <span className="font-medium text-ink">{f.error ? "Standard fixes" : "Fix ready"}</span> : <span className="text-muted-foreground">Looking into it</span>}
                    </span>
                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
              {!needs.length ? <li className="px-5 py-8 text-center text-sm text-muted-foreground">No failed gifts. Lifeline is watching PayPal for you.</li> : null}
            </ul>
            {closed.length ? (
              <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-5 py-3 text-xs text-muted-foreground">
                <span>Recently closed</span>
                {closed.map((f) => (
                  <Link key={f.id} href={`/rescues/${f.id}`} className="flex items-center gap-1.5 hover:text-ink">
                    <span className={f.status === "recovered" ? "size-1.5 rounded-full bg-recovered" : "size-1.5 rounded-full bg-ink-muted"} />
                    {f.donor.name.split(" ")[0]} · {f.status === "recovered" ? `${money(f.recoveredCents ?? 0)} back` : f.status}
                  </Link>
                ))}
              </footer>
            ) : null}
          </section>
        </div>
      </main>
      <ChatRail
        mood={needs.length ? (ready.length ? "happy" : "working") : "idle"}
        messages={[{ kind: "text", text: brief, chips: needs[0] ? [{ label: `Open ${needs[0].donor.name.split(" ")[0]}'s rescue`, href: `/rescues/${needs[0].id}` }] : [] }]}
      />
    </>
  );
}

function Initials({ name }: { name: string }) {
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2);
  return <span className="grid size-9 place-items-center rounded-full bg-muted text-xs font-medium text-ink-muted">{initials}</span>;
}

function RescuesSkeleton() {
  return (
    <main className="flex-1 space-y-5 px-8 py-6">
      <div className="mx-auto grid max-w-5xl grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="mx-auto h-64 max-w-5xl rounded-2xl" />
    </main>
  );
}
