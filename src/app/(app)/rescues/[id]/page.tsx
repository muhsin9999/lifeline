import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeftIcon } from "lucide-react";
import { ChatRail, type RailMessage } from "@/components/app/chat-rail";
import { DonorHistory } from "@/components/app/donor-history";
import { RescueActions } from "@/components/app/rescue-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { day, money } from "@/lib/format";
import { causeLabel } from "@/lib/labels";
import type { FixId } from "@/lib/fixes";
import { currentOrg, getRescue } from "@/server/queries";

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
  const working = r.status === "new" || r.status === "diagnosing";
  const note = r.notes[0] ?? null;
  const steps = r.trace ?? [];
  const messages: RailMessage[] = steps.length ? [{ kind: "work", steps, running: working }] : [{ kind: "text", text: working ? `Looking into ${first}'s failed gift…` : `Nothing to show for this rescue yet.` }];
  if (!working && r.diagnosis) messages.push({ kind: "text", text: `${r.diagnosis.summary}\n\nI suggest: ${r.recommendedFix === "note" ? `a short note to ${first}` : "the fix on the left"}. Nothing happens until you approve it.` });

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

          {working ? (
            <p className="rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-muted-foreground shadow-soft">Lifeline AI is looking into this. The fix appears here when it's ready.</p>
          ) : r.diagnosis ? (
            <>
              <p className="px-1 text-[15px] leading-relaxed text-pretty">{r.diagnosis.summary}</p>
              <RescueActions
                first={first}
                amount={money(r.amountCents)}
                fixes={(r.fixes ?? []) as FixId[]}
                recommended={(r.recommendedFix ?? "note") as FixId}
                retryOn={r.nextRetryAt ? day(r.nextRetryAt) : null}
                note={note ? { subject: note.subject, body: note.body, to: note.to } : null}
              />
            </>
          ) : null}
        </div>
      </main>
      <ChatRail mood={working ? "working" : r.status === "recovered" ? "happy" : "happy"} status={working ? `Working on ${first}'s rescue…` : "Fix ready for your approval"} messages={messages} />
    </>
  );
}
