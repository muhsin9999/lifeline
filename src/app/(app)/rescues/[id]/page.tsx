import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeftIcon } from "lucide-react";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { ChatRail, type RailMessage } from "@/components/app/chat-rail";
import { LookAgain } from "@/components/app/look-again";
import { DonorHistory } from "@/components/app/donor-history";
import { RescueActions } from "@/components/app/rescue-actions";
import { ResumeGift } from "@/components/app/resume-gift";
import { Skeleton } from "@/components/ui/skeleton";
import { day, money } from "@/lib/format";
import { causeLabel, plainWords } from "@/lib/labels";
import { FIXES, type FixId } from "@/lib/fixes";
import { currentOrg, getRescue, owedNow, resumedAt } from "@/server/queries";

export const metadata = { title: "Rescue" };

export default function RescuePage({ params }: PageProps<"/rescues/[id]">) {
  return (
    <Suspense fallback={<main className="flex-1 p-8"><Skeleton className="mx-auto h-96 max-w-4xl rounded-2xl" /></main>}>
      <Rescue params={params} />
    </Suspense>
  );
}

const since = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(d) : null);

async function Rescue({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const org = await currentOrg();
  const r = await getRescue(org.id, id);
  if (!r) notFound();
  const first = r.donor.name.split(" ")[0];
  const owed = r.donor.status === "SUSPENDED" ? ((await owedNow(r.donor.paypalSubscriptionId)) ?? r.donor.outstandingCents) : 0;
  const working = r.status === "new" || r.status === "diagnosing";
  const note = r.notes[0] ?? null;
  const steps = r.trace ?? [];
  const aiSteps = steps.filter((x) => x.tool !== "fallback");
  const messages: RailMessage[] = aiSteps.length > 1 || working ? [{ kind: "work", steps: aiSteps, running: working }] : [];
  if (!working && r.diagnosis)
    messages.push({
      kind: "text",
      text: r.error && r.status === "awaiting_approval" ? `I couldn't finish looking into ${first}'s gift, so I offered the standard fixes. Nothing happens until you approve one.` : r.status === "awaiting_approval" ? `Fix ready: ${r.recommendedFix === "note" ? `a short note to ${first}` : (FIXES[r.recommendedFix as FixId]?.label.toLowerCase() ?? "see the page")}. Nothing happens until you approve it.` : `Done. I'll keep watching ${first}'s gifts.`,
    });

  return (
    <>
      <main className="min-w-0 flex-1 px-6 py-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-5">
          <Link href="/rescues" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-ink">
            <ArrowLeftIcon className="size-3.5" /> Rescues
          </Link>

          <header className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{r.donor.name}</h1>
                <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                  Monthly gift · {money(r.donor.amountCents)}
                  {r.donor.startedAt ? ` · since ${since(r.donor.startedAt)}` : ""}
                </p>
              </div>
              <span className="rounded-full bg-brand-tint px-3 py-1 text-sm font-medium text-brand-strong tabular-nums">{money(r.donor.amountCents * 12)} a year at stake</span>
            </div>
            <DonorHistory gifts={r.donor.gifts.map((g) => ({ at: g.chargedAt.toISOString(), cents: g.amountCents, recovered: !!g.recoveredFailureId }))} failedAt={r.failedAt.toISOString()} open={r.status !== "recovered"} />
            <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-brand" />
              {day(r.failedAt)} · {causeLabel(r.reasonCode)}
              {r.nextRetryAt && r.status !== "recovered" ? ` · PayPal retries ${day(r.nextRetryAt)}` : ""}
            </p>
          </header>

          <AutoRefresh active={working} />
          {working ? (
            <p className="rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-muted-foreground shadow-soft">Lifeline AI is looking into this. The fix appears here when it&apos;s ready.</p>
          ) : r.status === "awaiting_approval" && r.diagnosis ? (
            <>
              <p className="px-1 text-[15px] leading-relaxed text-pretty">{plainWords(r.diagnosis.summary)}</p>
              {r.error ? <LookAgain failureId={r.id} /> : null}
              {r.donor.status === "SUSPENDED" ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-3 shadow-soft">
                  <p className="text-sm text-muted-foreground">
                    PayPal suspended {first}&apos;s gift after {r.donor.failedPaymentsCount || "several"} failed payments.{" "}
                    {owed > 0 ? `It can be resumed once the ${money(owed)} owed is collected: retry the charge after ${first} updates the card.` : "Nothing is charged until it's resumed."}
                  </p>
                  {owed > 0 ? null : <ResumeGift failureId={r.id} first={first} />}
                </div>
              ) : null}
              <RescueActions
                failureId={r.id}
                first={first}
                amount={money(r.amountCents)}
                amountCents={r.donor.amountCents}
                fixes={(r.fixes ?? []) as FixId[]}
                recommended={(r.recommendedFix ?? "note") as FixId}
                retryOn={r.nextRetryAt ? day(r.nextRetryAt) : null}
                note={note ? { subject: note.subject, body: note.body, to: note.to } : null}
              />
            </>
          ) : (
            <Outcome status={r.status} fix={r.chosenFix as FixId | null} first={first} recovered={r.recoveredCents} note={note} resumed={await resumedAt(r.id)}>
              {r.status === "paused" ? <ResumeGift failureId={r.id} first={first} /> : null}
            </Outcome>
          )}
        </div>
      </main>
      <ChatRail mood={working ? "working" : "happy"} status={working ? `Working on ${first}'s rescue…` : r.status === "awaiting_approval" ? "Fix ready for your approval" : "Rescue handled"} messages={messages} suggestions={[`What else do we know about ${first}?`, "Who else is at risk?"]} />
    </>
  );
}

const OUTCOME: Record<string, { tone: "good" | "wait" | "neutral"; title: (first: string) => string }> = {
  watching: { tone: "wait", title: (f) => `Watching for ${f}'s next gift` },
  acting: { tone: "wait", title: () => "Waiting for PayPal to confirm" },
  recovered: { tone: "good", title: (f) => `${f}'s gift is back` },
  paused: { tone: "neutral", title: (f) => `${f}'s monthly gift is paused` },
  cancelled: { tone: "neutral", title: (f) => `${f}'s monthly gift is cancelled` },
  lost: { tone: "neutral", title: (f) => `${f} stopped giving` },
};

function Outcome({ status, fix, first, recovered, note, resumed, children }: { status: string; fix: FixId | null; first: string; recovered: number | null; note: { status: string; sentAt: Date | null } | null; resumed: Date | null; children?: React.ReactNode }) {
  const o = OUTCOME[status] ?? { tone: "neutral" as const, title: () => status };
  return (
    <section className={o.tone === "good" ? "rounded-2xl border border-recovered/30 bg-recovered-tint px-5 py-4" : "rounded-2xl border border-line bg-surface px-5 py-4 shadow-soft"}>
      <p className="text-sm font-semibold">{o.title(first)}{status === "recovered" && recovered ? ` · ${money(recovered)}` : ""}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {fix ? `You approved: ${FIXES[fix].label.toLowerCase()}.` : null}
        {note?.status === "sent" && note.sentAt ? ` Note sent ${day(note.sentAt)}.` : null}
        {resumed ? ` Resumed ${day(resumed)}.` : null}
        {status === "watching" ? " Lifeline marks this recovered the moment PayPal reports the gift." : null}
      </p>
      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
