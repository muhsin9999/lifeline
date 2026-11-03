import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ChevronRightIcon } from "lucide-react";
import { ChatRail } from "@/components/app/chat-rail";
import { MiniPulse } from "@/components/app/mini-pulse";
import { Skeleton } from "@/components/ui/skeleton";
import { day, giftLabel, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { currentOrg, dailyDonors, getDonors, type DonorRow } from "@/server/queries";

export const metadata = { title: "Donors" };

const TABS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "risk", label: "At risk" },
  { id: "stopped", label: "Stopped" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const atRisk = (d: DonorRow) => !!d.openRescue;
const stopped = (d: DonorRow) => ["SUSPENDED", "CANCELLED", "EXPIRED"].includes(d.status);
const FILTER: Record<Tab, (d: DonorRow) => boolean> = { all: () => true, active: (d) => d.status === "ACTIVE" && !atRisk(d), risk: atRisk, stopped };

export default function DonorsPage({ searchParams }: PageProps<"/donors">) {
  return (
    <Suspense fallback={<main className="flex-1 p-8"><Skeleton className="mx-auto h-96 max-w-5xl rounded-2xl" /></main>}>
      <Donors searchParams={searchParams} />
    </Suspense>
  );
}

function Status({ d }: { d: DonorRow }) {
  if (d.openRescue) return <span className="rounded-full bg-brand-tint px-2 py-0.5 text-xs text-brand-strong">At risk</span>;
  if (d.status === "ACTIVE") return <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-ink-muted">Active</span>;
  const label = { SUSPENDED: "Paused", CANCELLED: "Cancelled", EXPIRED: "Ended", APPROVAL_PENDING: "Signing up" }[d.status] ?? d.status;
  return <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted">{label}</span>;
}

async function Donors({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const show = ((await searchParams).show as Tab) ?? "all";
  const tab: Tab = TABS.some((t) => t.id === show) ? show : "all";
  const org = await currentOrg();
  const [donors, daily] = await Promise.all([getDonors(org.id), dailyDonors(org.id)]);
  const rows = donors.filter(FILTER[tab]);
  const committed = donors.filter((d) => d.status === "ACTIVE").reduce((t, d) => t + d.amountCents, 0);
  const risky = donors.filter(atRisk);

  return (
    <>
      <main className="min-w-0 flex-1 px-6 py-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-5">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Donors</h1>
              <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                {donors.length} monthly {donors.length === 1 ? "donor" : "donors"} · {money(committed)} a month committed
              </p>
            </div>
            <nav aria-label="Filter donors" className="flex rounded-lg bg-muted p-0.5">
              {TABS.map((t) => {
                const n = donors.filter(FILTER[t.id]).length;
                return (
                  <Link key={t.id} href={t.id === "all" ? "/donors" : `/donors?show=${t.id}`} aria-current={tab === t.id ? "page" : undefined} className={cn("flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs text-ink-muted", tab === t.id && "bg-surface font-medium text-ink shadow-sm")}>
                    {t.label}
                    <span className="tabular-nums opacity-60">{n}</span>
                  </Link>
                );
              })}
            </nav>
          </header>

          <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
            <div className="hidden grid-cols-[minmax(0,1.6fr)_6rem_7rem_6rem_6rem_6rem_1rem] gap-3 border-b border-line px-5 py-2.5 text-xs text-muted-foreground md:grid">
              <span>Donor</span>
              <span>Recent giving</span>
              <span>Status</span>
              <span>Since</span>
              <span>Last gift</span>
              <span className="text-right">Total given</span>
              <span />
            </div>
            <ul className="divide-y divide-line">
              {rows.map((d) => (
                <li key={d.id}>
                  <Link href={`/donors/${d.id}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-5 py-3 hover:bg-paper/60 md:grid-cols-[minmax(0,1.6fr)_6rem_7rem_6rem_6rem_6rem_1rem]">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{d.name}</span>
                      <span className="block text-xs text-muted-foreground tabular-nums">{giftLabel(daily.has(d.id))} · {money(d.amountCents)}</span>
                    </span>
                    <span className="hidden md:block"><MiniPulse beats={d.giftCount} failing={!!d.openRescue} /></span>
                    <span className="hidden md:block"><Status d={d} /></span>
                    <span className="hidden text-xs text-muted-foreground tabular-nums md:block">{d.startedAt ? new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(d.startedAt) : "—"}</span>
                    <span className="hidden text-xs text-muted-foreground tabular-nums md:block">{day(d.lastPaymentAt) ?? "—"}</span>
                    <span className="hidden text-right md:block">
                      <span className="block text-sm tabular-nums">{money(d.givenCents)}</span>
                      <span className="block text-xs text-muted-foreground tabular-nums">{d.giftCount} {d.giftCount === 1 ? "gift" : "gifts"}</span>
                    </span>
                    <span className="md:hidden"><Status d={d} /></span>
                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
              {!rows.length ? <li className="px-5 py-8 text-center text-sm text-muted-foreground">No donors here.</li> : null}
            </ul>
          </section>
        </div>
      </main>
      <ChatRail
        messages={[{ kind: "text", text: risky.length ? `${risky.length} of ${donors.length} donors ${risky.length === 1 ? "has" : "have"} a failed gift I'm working on: ${risky.map((d) => d.name.split(" ")[0]).join(", ")}.` : `All ${donors.length} donors' gifts are going through.` }]}
        suggestions={["Who are our longest donors?", "Who gave the most?"]}
      />
    </>
  );
}
