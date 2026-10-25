import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeftIcon, BrainIcon, ChevronRightIcon } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ChatRail } from "@/components/app/chat-rail";
import { CopyButton } from "@/components/app/copy-button";
import { ResumeGift } from "@/components/app/resume-gift";
import { DonorHistory } from "@/components/app/donor-history";
import { Skeleton } from "@/components/ui/skeleton";
import { day, money } from "@/lib/format";
import { FIXES, type FixId } from "@/lib/fixes";
import { causeLabel } from "@/lib/labels";
import { currentOrg, getDonor } from "@/server/queries";

export const metadata = { title: "Donor" };

const OPEN = ["new", "diagnosing", "awaiting_approval", "acting", "watching"];
const RESCUE: Record<string, string> = { new: "Needs you", diagnosing: "Needs you", awaiting_approval: "Needs you", acting: "Watching", watching: "Watching", recovered: "Recovered", paused: "Paused", cancelled: "Cancelled", lost: "Lost" };
const SUB: Record<string, string> = { ACTIVE: "Active", SUSPENDED: "Paused", CANCELLED: "Cancelled", EXPIRED: "Ended", APPROVAL_PENDING: "Signing up" };
const since = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(d) : null);

export default function DonorPage({ params }: PageProps<"/donors/[id]">) {
  return (
    <Suspense fallback={<main className="flex-1 p-8"><Skeleton className="mx-auto h-96 max-w-3xl rounded-2xl" /></main>}>
      <Donor params={params} />
    </Suspense>
  );
}

async function Donor({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const org = await currentOrg();
  const d = await getDonor(org.id, id);
  if (!d) notFound();
  const first = d.name.split(" ")[0];
  const open = d.failures.find((f) => OPEN.includes(f.status));
  // Paused by Tunde, or suspended by PayPal after failed payments: resumed through the latest rescue.
  const paused = d.status === "SUSPENDED" ? (d.failures.find((f) => f.status === "paused") ?? d.failures[0]) : undefined;
  const given = d.gifts.reduce((t, g) => t + g.amountCents, 0);
  const memos = await db.select({ id: schema.memos.id, text: schema.memos.text }).from(schema.memos).where(eq(schema.memos.donorId, d.id)).orderBy(desc(schema.memos.createdAt));

  return (
    <>
      <main className="min-w-0 flex-1 px-6 py-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-5">
          <Link href="/donors" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-ink">
            <ArrowLeftIcon className="size-3.5" /> Donors
          </Link>
          <header className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{d.name}</h1>
                <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                  Monthly gift · {money(d.amountCents)}
                  {d.startedAt ? ` · since ${since(d.startedAt)}` : ""} · {SUB[d.status] ?? d.status}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold tracking-tight tabular-nums">{money(given)}</p>
                <p className="text-xs text-muted-foreground">given in {d.gifts.length} {d.gifts.length === 1 ? "gift" : "gifts"}</p>
              </div>
            </div>
            {paused ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground">{paused.status === "paused" ? `You paused ${first}'s gift ${day(paused.resolvedAt ?? paused.failedAt)}.` : `PayPal suspended ${first}'s gift after failed payments.`}</p>
                <ResumeGift failureId={paused.id} first={first} />
              </div>
            ) : null}
            <DonorHistory gifts={d.gifts.map((g) => ({ at: g.chargedAt.toISOString(), cents: g.amountCents, recovered: !!g.recoveredFailureId }))} failedAt={open?.failedAt.toISOString()} open={!!open} />
            {open ? (
              <Link href={`/rescues/${open.id}`} className="mt-1 inline-flex items-center gap-2 text-xs text-brand-strong hover:underline">
                <span className="size-1.5 rounded-full bg-brand" />
                {day(open.failedAt)} · {causeLabel(open.reasonCode)} · {RESCUE[open.status]} · open the rescue
              </Link>
            ) : null}
          </header>

          {memos.length ? (
            <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <BrainIcon className="size-4 text-muted-foreground" /> What you told Lifeline about {first}
              </h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                {memos.map((m) => (
                  <li key={m.id} className="rounded-lg bg-paper px-3 py-2">{m.text}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Lifeline AI reads this when it looks into {first}&apos;s next failed gift.</p>
            </section>
          ) : null}

          {d.failures.length ? (
            <section className="rounded-2xl border border-line bg-surface shadow-soft">
              <h2 className="px-5 pt-4 pb-2 text-sm font-semibold">Rescues</h2>
              <ul className="divide-y divide-line">
                {d.failures.map((f) => (
                  <li key={f.id}>
                    <Link href={`/rescues/${f.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-paper/60">
                      <span className={OPEN.includes(f.status) ? "size-1.5 rounded-full bg-brand" : f.status === "recovered" ? "size-1.5 rounded-full bg-recovered" : "size-1.5 rounded-full bg-ink-muted"} />
                      <span className="w-16 text-xs text-muted-foreground tabular-nums">{day(f.failedAt)}</span>
                      <span className="min-w-0 flex-1 truncate">{causeLabel(f.reasonCode)} · {money(f.amountCents)}</span>
                      <span className="text-xs text-muted-foreground">{RESCUE[f.status] ?? f.status}{f.chosenFix ? ` · ${FIXES[f.chosenFix as FixId]?.label.toLowerCase() ?? f.chosenFix}` : ""}</span>
                      <ChevronRightIcon className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-2xl border border-line bg-surface shadow-soft">
            <h2 className="px-5 pt-4 pb-2 text-sm font-semibold">Gifts</h2>
            <ul className="divide-y divide-line">
              {[...d.gifts].reverse().map((g) => (
                <li key={g.id}>
                  {/* The PayPal transaction ID only matters for looking a payment up in PayPal, so it sits one click in. */}
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-2.5 text-sm hover:bg-paper/60 [&::-webkit-details-marker]:hidden">
                      <span className="w-24 text-xs text-muted-foreground tabular-nums">{day(g.chargedAt)}</span>
                      <span className="flex-1 tabular-nums">{money(g.amountCents)}</span>
                      {g.recoveredFailureId ? <span className="rounded-full bg-recovered-tint px-2 py-0.5 text-xs text-recovered">Recovered by Lifeline</span> : null}
                      <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
                    </summary>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-paper/50 px-5 py-3 text-xs">
                      <span className="text-muted-foreground">
                        Charged {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(g.chargedAt)}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground">PayPal transaction ID</span>
                        <span className="font-mono text-[11px] text-ink">{g.paypalTransactionId}</span>
                        <CopyButton value={g.paypalTransactionId} label="PayPal transaction ID" />
                      </span>
                    </div>
                  </details>
                </li>
              ))}
              {!d.gifts.length ? <li className="px-5 py-6 text-center text-sm text-muted-foreground">No gifts yet.</li> : null}
            </ul>
          </section>
        </div>
      </main>
      <ChatRail
        messages={[{ kind: "text", text: open ? `${first}'s latest gift failed, and the rescue is ${RESCUE[open.status].toLowerCase()}. ${first} has given ${money(given)} so far.` : `${first} has given ${money(given)} in ${d.gifts.length} ${d.gifts.length === 1 ? "gift" : "gifts"}.` }]}
        suggestions={[`How has ${first} given over time?`]}
      />
    </>
  );
}
