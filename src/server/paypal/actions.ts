// The officer-approved fixes, as durable writes (paypal-plan.md §1b.1): claim → PayPal call → record. The claim
// row is committed before the call, so a second click or a retry can't reach PayPal twice, and a lost answer
// leaves something to settle by re-reading PayPal.
import "server-only";
import { and, eq } from "drizzle-orm";
import type { PaypalClient, Subscription } from "paypal";
import { db, schema as s } from "@/db";
import { money } from "@/lib/format";
import { cents } from "@/lib/paypal-events";
import { FIXES, type FixId } from "@/lib/fixes";
import { sendNote } from "../mail";
import { outcomeOf, type PayPalOutcome } from "./errors";
import { paypalSdk } from "./sdk";

export type FixResult =
  | { ok: true; message: string }
  | { ok: false; status: number; message: string; pending?: boolean };

type Claim = typeof s.paypalActions.$inferSelect;

const isUniqueViolation = (e: unknown) => {
  const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
  return code === "23505";
};

/** Inserts the claim, or returns the row that already holds it (the winner of a race, or an earlier click). */
export async function claimAction(values: { claimKey: string; orgId: string; failureId: string; kind: string }): Promise<{ claimed: true; row: Claim } | { claimed: false; row: Claim }> {
  try {
    const [row] = await db.insert(s.paypalActions).values(values).returning();
    return { claimed: true, row };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const row = await db.query.paypalActions.findFirst({ where: eq(s.paypalActions.claimKey, values.claimKey) });
    if (!row) throw e;
    return { claimed: false, row };
  }
}

const release = (claim: Claim) => db.delete(s.paypalActions).where(eq(s.paypalActions.id, claim.id));
const settle = (claim: Claim, status: "done" | "unknown", result?: unknown, error?: string) =>
  db.update(s.paypalActions).set({ status, result: result ?? null, error: error ?? null, settledAt: status === "done" ? new Date() : null }).where(eq(s.paypalActions.id, claim.id));

const usd = (c: number) => (c / 100).toFixed(2);
const statusOf = (sub: Subscription) => {
  const v = (sub as { status?: unknown }).status; // not on the SDK type (paypal-plan.md, Assumption 1)
  return typeof v === "string" ? v : null;
};
const firstCyclePrice = (sub: Subscription) => sub.plan?.billingCycles?.find((c) => c.sequence === 1)?.pricingScheme?.fixedPrice?.value ?? null;

/** What a re-read must show for each write to count as done (paypal-plan.md, UNKNOWN OUTCOMES). */
function confirmedBy(fix: FixId | "resume", sub: Subscription, claim: Claim, newAmountCents?: number) {
  const owed = sub.billingInfo?.outstandingBalance?.value;
  switch (fix) {
    case "retry": {
      const paid = sub.billingInfo?.lastPayment?.time;
      return Number(owed ?? "1") === 0 && !!paid && new Date(paid) > claim.createdAt;
    }
    case "pause":
      return statusOf(sub) === "SUSPENDED";
    case "resume":
      return statusOf(sub) === "ACTIVE";
    case "cancel":
      return statusOf(sub) === "CANCELLED";
    case "lower":
      return newAmountCents !== undefined && firstCyclePrice(sub) === usd(newAmountCents);
    case "forgive":
      return Number(owed ?? "1") === 0;
    case "note":
      return false;
  }
}

/** Re-reads the subscription after a write whose answer was lost. Found → done; not found or re-read failed → still unknown. */
async function reread(client: PaypalClient, fix: FixId | "resume", subscriptionId: string, claim: Claim, newAmountCents?: number) {
  try {
    const sub = await client.subscriptions.getSubscription({ id: subscriptionId });
    if (confirmedBy(fix, sub, claim, newAmountCents)) {
      await settle(claim, "done", { reread: true });
      return true;
    }
  } catch (e) {
    outcomeOf(e); // rethrows anything outside the SDK family
  }
  await settle(claim, "unknown", null, "PayPal didn't answer; re-read did not confirm");
  return false;
}

function failed(o: PayPalOutcome): FixResult {
  switch (o.kind) {
    case "refused":
      return { ok: false, status: o.status, message: o.reason };
    case "unavailable":
      return { ok: false, status: o.status === 429 ? 503 : 502, message: o.message };
    case "never_sent":
      return { ok: false, status: 500, message: o.message };
    case "no_response":
    case "unreadable":
      return { ok: false, status: 502, message: "We're checking with PayPal whether this went through.", pending: true };
  }
}

/**
 * Runs one approved fix for a failed gift. `failureId` is Lifeline's own id: the subscription is looked up from
 * Lifeline's records for the officer's organisation, never taken from the caller (§1b.2).
 */
export async function runFix(input: { orgId: string; failureId: string; fix: FixId; approvedBy: string; newAmountCents?: number; note?: { subject: string; body: string } }, client: PaypalClient = paypalSdk()): Promise<FixResult> {
  const failure = await db.query.failures.findFirst({ where: and(eq(s.failures.id, input.failureId), eq(s.failures.orgId, input.orgId)), with: { donor: true } });
  if (!failure) return { ok: false, status: 404, message: "That rescue doesn't exist." };
  if (!(failure.fixes ?? []).includes(input.fix)) return { ok: false, status: 400, message: "That fix wasn't offered for this gift." };
  if (input.fix === "lower" && !(input.newAmountCents && input.newAmountCents > 0 && input.newAmountCents < failure.donor.amountCents))
    return { ok: false, status: 400, message: "The new amount must be more than $0 and less than the current gift." };
  const subscriptionId = failure.donor.paypalSubscriptionId;
  if (!subscriptionId) return { ok: false, status: 409, message: "This donor has no PayPal subscription yet." };
  const practice = input.fix !== "note" && (await inPracticeCopy(input.orgId));

  // A charge whose answer was lost is settled first, by re-reading PayPal: once it went through, PayPal shows
  // nothing owed, and the "nothing to retry" check below would otherwise hide that it was ours (live, 3 Nov 2026).
  const earlier = await db.query.paypalActions.findFirst({ where: eq(s.paypalActions.claimKey, `${input.fix}:${failure.id}`) });
  if (earlier?.status === "unknown" && input.fix !== "note" && !practice) {
    if (await reread(client, input.fix, subscriptionId, earlier, input.newAmountCents)) {
      await afterFix(input, failure, earlier);
      return { ok: true, message: "PayPal confirms this went through." };
    }
    return { ok: false, status: 409, message: "We're still checking with PayPal whether this went through.", pending: true };
  }

  // Retry charges what PayPal says is owed, read before the claim: a read that fails is not a write in doubt.
  let owed: { currencyCode: string; value: string } | null = null;
  if (input.fix === "retry") {
    try {
      const sub = await client.subscriptions.getSubscription({ id: subscriptionId });
      owed = sub.billingInfo?.outstandingBalance ?? null;
    } catch (e) {
      const o = outcomeOf(e);
      return o.kind === "refused" ? failed(o) : { ok: false, status: 502, message: "Couldn't reach PayPal to check what's owed." };
    }
    if (!owed || Number(owed.value) <= 0) return { ok: false, status: 409, message: "PayPal shows nothing owed on this gift, so there's nothing to retry." };
  }
  if (practice) return practiceRun(input, failure, practiceCall(input.fix, subscriptionId, { owed, newAmountCents: input.newAmountCents }));

  const c = await claimAction({ claimKey: `${input.fix}:${failure.id}`, orgId: input.orgId, failureId: failure.id, kind: input.fix });
  if (!c.claimed) {
    if (c.row.status === "done") return { ok: true, message: "Already done." };
    if (c.row.status === "unknown" && input.fix !== "note") {
      const done = await reread(client, input.fix, subscriptionId, c.row, input.newAmountCents);
      if (done) {
        await afterFix(input, failure, c.row);
        return { ok: true, message: "PayPal confirms this went through." };
      }
    }
    return { ok: false, status: 409, message: "This fix is already in progress.", pending: true };
  }
  const claim = c.row;

  if (input.fix === "note") {
    const note = input.note ?? (await db.query.notes.findFirst({ where: eq(s.notes.failureId, failure.id) }));
    if (!note) {
      await release(claim);
      return { ok: false, status: 400, message: "There's no note to send." };
    }
    const sent = await sendNote({ donorName: failure.donor.name, donorEmail: failure.donor.email, subject: note.subject, body: note.body });
    if (!sent.ok) {
      await release(claim);
      return { ok: false, status: sent.status, message: sent.message };
    }
    await settle(claim, "done", { providerId: sent.id, to: sent.to });
    await db.update(s.notes).set({ status: "sent", providerId: sent.id, sentAt: new Date(), subject: note.subject, body: note.body }).where(eq(s.notes.failureId, failure.id));
    await afterFix(input, failure, claim);
    return { ok: true, message: `Note sent to ${sent.to}.` };
  }

  try {
    let result: unknown = null;
    if (input.fix === "retry" && owed) {
      const tx = await client.subscriptions.captureSubscription({
        id: subscriptionId,
        payPalRequestId: claim.id,
        body: { note: "Monthly gift retried by Lifeline after approval", captureType: "OUTSTANDING_BALANCE", amount: { currencyCode: owed.currencyCode, value: owed.value } },
      });
      if (!tx.id) throw new Error("PayPal returned no transaction id for the capture");
      result = { transactionId: tx.id, status: tx.status ?? null, time: tx.time };
      await db
        .insert(s.gifts)
        .values({ orgId: input.orgId, donorId: failure.donorId, paypalTransactionId: tx.id, amountCents: cents(owed) ?? failure.amountCents, chargedAt: new Date(tx.time), recoveredFailureId: failure.id })
        .onConflictDoNothing({ target: [s.gifts.orgId, s.gifts.paypalTransactionId] });
    } else {
      const call =
        input.fix === "pause"
          ? client.subscriptions.suspendSubscription({ id: subscriptionId, body: { reason: "Paused by the nonprofit after a failed monthly gift" } }).asApiResult()
          : input.fix === "cancel"
            ? client.subscriptions.cancelSubscription({ id: subscriptionId, body: { reason: "Cancelled by the nonprofit at the donor's request" } }).asApiResult()
            : client.subscriptions
                .patchSubscription({
                  id: subscriptionId,
                  body: [
                    input.fix === "lower"
                      ? { op: "replace", path: "/plan/billing_cycles/@sequence==1/pricing_scheme/fixed_price", value: { currency_code: "USD", value: usd(input.newAmountCents!) } }
                      : { op: "replace", path: "/billing_info/outstanding_balance", value: { currency_code: "USD", value: "0.00" } },
                  ],
                })
                .asApiResult();
      const r = await call;
      if (!r.ok) {
        const body = (r.payload as { body?: { message?: string; debugId?: string; details?: { issue?: string; description?: string }[] } }).body;
        await release(claim);
        if (r.status === 401 || r.status === 403) return { ok: false, status: 502, message: "Lifeline couldn’t sign in to PayPal." };
        if (r.status === 429) return { ok: false, status: 503, message: "PayPal is busy. Try again in a minute." };
        if (r.status >= 500) return { ok: false, status: 502, message: "PayPal had a problem. Try again shortly." };
        const d = body?.details?.[0];
        return { ok: false, status: r.status, message: d?.description ?? d?.issue ?? body?.message ?? `PayPal refused the request (${r.status}).` };
      }
      result = { status: r.status };
    }
    await settle(claim, "done", result);
    await afterFix(input, failure, claim);
    return { ok: true, message: DONE[input.fix](failure.donor.name.split(" ")[0]) };
  } catch (e) {
    const o = outcomeOf(e);
    if (o.kind === "no_response" || o.kind === "unreadable") {
      const done = await reread(client, input.fix, subscriptionId, claim, input.newAmountCents);
      if (done) {
        await afterFix(input, failure, claim);
        return { ok: true, message: "PayPal confirms this went through." };
      }
      return failed(o);
    }
    await release(claim);
    return failed(o);
  }
}

/**
 * Resumes a paused or PayPal-suspended gift (activateSubscription). Same rules as the fixes: the rescue must belong to
 * the officer's organisation, the claim is committed before the call, and a lost answer is settled by re-reading
 * PayPal. A rescue the officer paused goes back to watching, so the next gift PayPal reports recovers it.
 */
export async function resumeGift(input: { orgId: string; failureId: string; approvedBy: string }, client: PaypalClient = paypalSdk()): Promise<FixResult> {
  const failure = await db.query.failures.findFirst({ where: and(eq(s.failures.id, input.failureId), eq(s.failures.orgId, input.orgId)), with: { donor: true } });
  if (!failure) return { ok: false, status: 404, message: "That rescue doesn't exist." };
  // Paused by the officer from this rescue, or suspended by PayPal itself after too many failed payments.
  if (failure.status !== "paused" && failure.donor.status !== "SUSPENDED") return { ok: false, status: 409, message: "This gift isn't paused." };
  const subscriptionId = failure.donor.paypalSubscriptionId;
  if (!subscriptionId) return { ok: false, status: 409, message: "This donor has no PayPal subscription yet." };
  const first = failure.donor.name.split(" ")[0];
  // PayPal won't reactivate a subscription it suspended for failed payments while money is owed ("Subscription cannot
  // be activated after payment failure threshold has reached", sandbox, 25 Oct 2026): collect it first with Retry.
  // PayPal is asked, not Lifeline's copy; a read that fails is not a write in doubt.
  if (failure.status !== "paused") {
    let owedCents: number;
    try {
      const sub = await client.subscriptions.getSubscription({ id: subscriptionId });
      owedCents = cents(sub.billingInfo?.outstandingBalance) ?? 0;
    } catch (e) {
      const o = outcomeOf(e);
      return o.kind === "refused" ? failed(o) : { ok: false, status: 502, message: "Couldn't reach PayPal to check what's owed." };
    }
    if (owedCents > 0) {
      await db.update(s.donors).set({ outstandingCents: owedCents }).where(eq(s.donors.id, failure.donorId));
      return { ok: false, status: 409, message: `PayPal resumes this gift only once the ${money(owedCents)} owed is collected. Retry the charge first.` };
    }
  }

  if (await inPracticeCopy(input.orgId)) return practiceRun({ ...input, fix: "resume" }, failure, practiceCall("resume", subscriptionId, {}));

  const c = await claimAction({ claimKey: `resume:${failure.id}`, orgId: input.orgId, failureId: failure.id, kind: "resume" });
  if (!c.claimed) {
    if (c.row.status === "done") return { ok: true, message: "Already done." };
    if (c.row.status === "unknown" && (await reread(client, "resume", subscriptionId, c.row))) {
      await afterResume(input, failure, c.row);
      return { ok: true, message: "PayPal confirms this went through." };
    }
    return { ok: false, status: 409, message: "Resuming is already in progress.", pending: true };
  }
  const claim = c.row;
  try {
    const r = await client.subscriptions.activateSubscription({ id: subscriptionId, body: { reason: "Resumed by the nonprofit" } }).asApiResult();
    if (!r.ok) {
      const body = (r.payload as { body?: { message?: string; details?: { issue?: string; description?: string }[] } }).body;
      await release(claim);
      if (r.status === 401 || r.status === 403) return { ok: false, status: 502, message: "Lifeline couldn’t sign in to PayPal." };
      if (r.status === 429) return { ok: false, status: 503, message: "PayPal is busy. Try again in a minute." };
      if (r.status >= 500) return { ok: false, status: 502, message: "PayPal had a problem. Try again shortly." };
      const d = body?.details?.[0];
      return { ok: false, status: r.status, message: d?.description ?? d?.issue ?? body?.message ?? `PayPal refused the request (${r.status}).` };
    }
    await settle(claim, "done", { status: r.status });
    await afterResume(input, failure, claim);
    return { ok: true, message: `${first}'s monthly gift is back on.` };
  } catch (e) {
    const o = outcomeOf(e);
    if (o.kind === "no_response" || o.kind === "unreadable") {
      if (await reread(client, "resume", subscriptionId, claim)) {
        await afterResume(input, failure, claim);
        return { ok: true, message: "PayPal confirms this went through." };
      }
      return failed(o);
    }
    await release(claim);
    return failed(o);
  }
}

async function afterResume(input: { orgId: string; approvedBy: string }, failure: FailureWithDonor, claim: Claim, practice?: string) {
  if (failure.status === "paused") await db.update(s.failures).set({ status: "watching", resolvedAt: null }).where(eq(s.failures.id, failure.id));
  await db.update(s.donors).set({ status: "ACTIVE" }).where(eq(s.donors.id, failure.donorId));
  await db.insert(s.events).values({ orgId: input.orgId, donorId: failure.donorId, source: "lifeline", type: "FIX.RESUME", summary: `${practice ? "Practice: " : ""}Resumed the gift: ${failure.donor.name}`, verified: !practice });
  await db.insert(s.audit).values({ orgId: input.orgId, kind: "fix.resume", subjectType: "failure", subjectId: failure.id, output: { claim: claim.claimKey, ...(practice && { practice: true, wouldSend: practice }) }, approvedBy: input.approvedBy });
}

const DONE: Record<FixId, (first: string) => string> = {
  note: (f) => `Note sent to ${f}.`,
  retry: (f) => `${f}'s gift went through.`,
  pause: (f) => `${f}'s monthly gift is paused.`,
  lower: (f) => `${f}'s monthly gift is lowered.`,
  forgive: () => "This month is forgiven; the next gift starts fresh.",
  cancel: (f) => `${f}'s monthly gift is cancelled.`,
};

type FailureWithDonor = NonNullable<Awaited<ReturnType<typeof db.query.failures.findFirst>>> & { donor: typeof s.donors.$inferSelect };

/** Records what the fix changed: the rescue's state, the donor mirror, the timeline and the audit trail. */
async function afterFix(input: { orgId: string; fix: FixId; approvedBy: string; newAmountCents?: number }, failure: FailureWithDonor, claim: Claim, practice?: string) {
  const now = new Date();
  const status = input.fix === "retry" ? "recovered" : input.fix === "pause" ? "paused" : input.fix === "cancel" ? "cancelled" : "watching";
  await db
    .update(s.failures)
    .set({ status, chosenFix: input.fix, ...(input.fix === "retry" && { recoveredCents: failure.amountCents }), ...(status !== "watching" && { resolvedAt: now }) })
    .where(eq(s.failures.id, failure.id));
  if (input.fix === "pause") await db.update(s.donors).set({ status: "SUSPENDED" }).where(eq(s.donors.id, failure.donorId));
  if (input.fix === "cancel") await db.update(s.donors).set({ status: "CANCELLED" }).where(eq(s.donors.id, failure.donorId));
  if (input.fix === "lower" && input.newAmountCents) await db.update(s.donors).set({ amountCents: input.newAmountCents }).where(eq(s.donors.id, failure.donorId));
  if (input.fix === "retry" || input.fix === "forgive") await db.update(s.donors).set({ outstandingCents: 0 }).where(eq(s.donors.id, failure.donorId));
  await db.insert(s.events).values({ orgId: input.orgId, donorId: failure.donorId, source: "lifeline", type: `FIX.${input.fix.toUpperCase()}`, summary: `${practice ? "Practice: " : ""}${FIXES[input.fix].label}: ${failure.donor.name}`, verified: !practice });
  await db.insert(s.audit).values({ orgId: input.orgId, kind: `fix.${input.fix}`, subjectType: "failure", subjectId: failure.id, output: { claim: claim.claimKey, newAmountCents: input.newAmountCents ?? null, ...(practice && { practice: true, wouldSend: practice }) }, approvedBy: input.approvedBy });
}

/** A visitor's practice copy (server/workspace.ts): fixes that would change PayPal are shown, not sent. */
async function inPracticeCopy(orgId: string) {
  const org = await db.query.orgs.findFirst({ where: eq(s.orgs.id, orgId), columns: { copyOf: true } });
  return !!org?.copyOf;
}

/** The exact PayPal call a fix makes, in words and as the request line. */
export function practiceCall(fix: FixId | "resume", subscriptionId: string, o: { owed?: { value: string } | null; newAmountCents?: number }) {
  const path = `/v1/billing/subscriptions/${subscriptionId}`;
  switch (fix) {
    case "retry":
      return `charge the $${o.owed?.value ?? "?"} owed (POST ${path}/capture)`;
    case "pause":
      return `pause the gift (POST ${path}/suspend)`;
    case "cancel":
      return `cancel the gift (POST ${path}/cancel)`;
    case "lower":
      return `lower the gift to $${usd(o.newAmountCents ?? 0)} a month (PATCH ${path})`;
    case "forgive":
      return `clear what's owed (PATCH ${path}, outstanding balance to $0.00)`;
    case "resume":
      return `resume the gift (POST ${path}/activate)`;
    case "note":
      return "send the note";
  }
}

/** Runs a fix in a practice copy: the same claim and the same bookkeeping, but PayPal is not called. */
async function practiceRun(input: { orgId: string; failureId: string; fix: FixId | "resume"; approvedBy: string; newAmountCents?: number }, failure: FailureWithDonor, call: string): Promise<FixResult> {
  const c = await claimAction({ claimKey: `${input.fix}:${failure.id}`, orgId: input.orgId, failureId: failure.id, kind: input.fix });
  if (!c.claimed) return c.row.status === "done" ? { ok: true, message: "Already done." } : { ok: false, status: 409, message: "This fix is already in progress.", pending: true };
  await settle(c.row, "done", { practice: true, wouldSend: call });
  if (input.fix === "resume") await afterResume(input, failure, c.row, call);
  else await afterFix({ ...input, fix: input.fix }, failure, c.row, call);
  return { ok: true, message: `Practice copy, so PayPal wasn't changed. Live, Lifeline would ${call}.` };
}
