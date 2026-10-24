import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowRightIcon, ChevronRightIcon } from "lucide-react";
import { ChatRail } from "@/components/app/chat-rail";
import { GivingPulse } from "@/components/app/giving-pulse";
import { KpiRow } from "@/components/app/kpis";
import { AgentAvatar } from "@/components/brand/agent-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { money } from "@/lib/format";
import { causeLabel, timeAgo } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { currentOrg, getActivity, getKpis, getNeedsYou, getPulse, getRecentlyClosed, getWatching } from "@/server/queries";

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
  const [kpis, pulse, needs, watching, closed, latest] = await Promise.all([getKpis(org.id, now), getPulse(org.id, now, 90), getNeedsYou(org.id), getWatching(org.id), getRecentlyClosed(org.id), getActivity(org.id, 5)]);
  const ready = needs.filter((f) => f.status === "awaiting_approval" && !f.error);
  const fallback = needs.filter((f) => f.status === "awaiting_approval" && f.error);
  const hour = now.getUTCHours() + 1; // Tunde works on West Africa Time
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const waitingOn = watching.map((f) => f.donor.name.split(" ")[0]);
  const watchLine = waitingOn.length ? ` I'm watching for ${waitingOn.length === 1 ? `${waitingOn[0]}'s` : `${waitingOn.length} donors'`} next gift after your fix.` : "";
  const brief = needs.length
    ? `${greeting}, Tunde. ${needs.length} monthly ${needs.length === 1 ? "gift needs" : "gifts need"} you.${ready.length ? ` I've looked into ${ready.length}; ${ready.length === 1 ? "a fix is" : "fixes are"} ready.` : ""}${fallback.length ? ` I couldn't finish ${fallback.length === 1 ? "one" : fallback.length}, so standard fixes are waiting.` : ""}${watchLine}`
    : watching.length
      ? `${greeting}, Tunde. Nothing needs you right now.${watchLine}`
      : `${greeting}, Tunde. Every monthly gift went through. I'll tell you the moment one fails.`;

  return (
    <>
      <main className="min-w-0 flex-1 px-6 py-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-5">
          <header>
            <h1 className="text-xl font-semibold tracking-tight">Rescues</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" }).format(now)} · monthly gifts that failed, and what Lifeline is doing about them</p>
          </header>
          <KpiRow k={kpis} />
          <GivingPulse pulse={pulse} />
          <section className="rounded-2xl border border-line bg-surface shadow-soft">
            <header className="flex items-baseline justify-between px-5 pt-4 pb-2">
              <h2 className="text-sm font-semibold">Needs you</h2>
              <span className="text-xs text-muted-foreground">{needs.length ? `${needs.length} open` : watching.length ? `${watching.length} watching` : "All clear"}</span>
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
              {!needs.length ? <li className="px-5 py-6 text-center text-sm text-muted-foreground">{watching.length ? "Nothing needs you. Lifeline is watching the rescues below." : "No failed gifts. Lifeline is watching PayPal for you."}</li> : null}
              {watching.map((f) => (
                <li key={f.id}>
                  <Link href={`/rescues/${f.id}`} className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 px-5 py-3 hover:bg-paper/60 sm:grid-cols-[2.25rem_minmax(0,1.4fr)_minmax(0,1fr)_auto_auto]">
                    <Initials name={f.donor.name} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{f.donor.name}</span>
                      <span className="block text-xs text-muted-foreground tabular-nums">Monthly gift · {money(f.donor.amountCents)}</span>
                    </span>
                    <span className="hidden text-xs text-muted-foreground sm:block">{f.chosenFix === "note" ? "Note sent" : "Fix approved"} · waiting for the next gift</span>
                    <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                      <AgentAvatar calm mood="idle" className="size-6" label="" />
                      Watching
                    </span>
                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
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

          {latest.length ? (
            <section className="rounded-2xl border border-line bg-surface shadow-soft">
              <header className="flex items-baseline justify-between px-5 pt-4 pb-2">
                <h2 className="text-sm font-semibold">Latest from PayPal</h2>
                <Link href="/activity" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-ink">
                  All activity <ArrowRightIcon className="size-3" />
                </Link>
              </header>
              <ol className="divide-y divide-line">
                {latest.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-5 py-2.5">
                    {e.source === "paypal" ? <span className={cn("size-1.5 shrink-0 rounded-full", e.type.endsWith("PAYMENT.FAILED") ? "bg-brand" : e.type === "PAYMENT.SALE.COMPLETED" ? "bg-recovered" : "bg-ink-muted")} /> : <AgentAvatar calm still mood="happy" className="size-4" label="" />}
                    <span className="min-w-0 flex-1 truncate text-sm">{e.summary}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{timeAgo(e.occurredAt, now)}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      </main>
      <ChatRail
        mood={needs.length ? (ready.length ? "happy" : "working") : "idle"}
        suggestions={["Who needs me today?", "How much have we recovered?", "How did giving go this month?"]}
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
