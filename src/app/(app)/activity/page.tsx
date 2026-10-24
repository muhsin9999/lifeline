import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ShieldCheckIcon } from "lucide-react";
import { ChatRail } from "@/components/app/chat-rail";
import { AgentAvatar } from "@/components/brand/agent-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { currentOrg, getActivity, getWebhookHealth } from "@/server/queries";

export const metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <Suspense fallback={<main className="flex-1 p-8"><Skeleton className="mx-auto h-96 max-w-3xl rounded-2xl" /></main>}>
      <Activity />
    </Suspense>
  );
}

const dayLabel = (d: Date, now: Date) => {
  const k = (x: Date) => x.toISOString().slice(0, 10);
  if (k(d) === k(now)) return "Today";
  if (k(d) === k(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(d);
};
const time = (d: Date) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(d);
const tone = (type: string) => (type.endsWith("PAYMENT.FAILED") ? "bg-brand" : type === "PAYMENT.SALE.COMPLETED" ? "bg-recovered" : "bg-ink-muted");

async function Activity() {
  await connection();
  const now = new Date();
  const org = await currentOrg();
  const [events, health] = await Promise.all([getActivity(org.id), getWebhookHealth(now)]);
  const groups = new Map<string, typeof events>();
  for (const e of events) {
    const key = dayLabel(e.occurredAt, now);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  return (
    <>
      <main className="min-w-0 flex-1 px-6 py-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-5">
          <header>
            <h1 className="text-xl font-semibold tracking-tight">Activity</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground tabular-nums">
              <ShieldCheckIcon className="size-4 text-recovered" />
              PayPal webhooks, last 30 days: {health.total} received · {health.verified} signature-verified · {health.rejected} rejected
            </p>
          </header>

          {[...groups.entries()].map(([label, list]) => (
            <section key={label} className="rounded-2xl border border-line bg-surface shadow-soft">
              <h2 className="px-5 pt-4 pb-1 text-xs font-medium text-muted-foreground">{label}</h2>
              <ol className="divide-y divide-line">
                {list.map((e) => {
                  const fromPayPal = e.source === "paypal";
                  const row = (
                    <>
                      <span className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">{time(e.occurredAt)}</span>
                      {fromPayPal ? <span className={cn("size-1.5 shrink-0 rounded-full", tone(e.type))} /> : <AgentAvatar calm still mood="happy" className="size-4" label="" />}
                      <span className="min-w-0 flex-1 truncate text-sm">{e.summary}</span>
                      {fromPayPal ? (
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px]", e.verified ? "bg-recovered-tint text-recovered" : "bg-muted text-ink-muted")}>{e.simulated ? "Simulated" : e.verified ? "PayPal · verified" : "PayPal"}</span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-ink-muted">Lifeline</span>
                      )}
                    </>
                  );
                  return (
                    <li key={e.id}>
                      {e.donorId ? (
                        <Link href={`/donors/${e.donorId}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-paper/60">
                          {row}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 px-5 py-2.5">{row}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {!events.length ? <p className="rounded-2xl border border-line bg-surface px-5 py-8 text-center text-sm text-muted-foreground">Nothing yet. Events from PayPal appear here as they arrive.</p> : null}
        </div>
      </main>
      <ChatRail messages={[{ kind: "text", text: `I check every PayPal event's signature before it reaches this list. ${health.verified} verified in the last 30 days${health.rejected ? `, ${health.rejected} rejected` : ""}.` }]} suggestions={["What happened this week?"]} />
    </>
  );
}
