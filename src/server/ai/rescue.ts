// The rescue agent, wired to the database: loads one failed gift's case, runs the agent (rescue-agent.ts) and stores
// the diagnosis, the fixes and the draft note for the officer's approval. Nothing reaches PayPal or the donor until
// the officer approves (actions.ts).
import "server-only";
import { createHash } from "node:crypto";
import { and, asc, eq, ne, desc } from "drizzle-orm";
import type OpenAI from "openai";
import type { PaypalClient } from "paypal";
import { db, schema as s } from "@/db";
import { causeLabel, plainWords } from "@/lib/labels";
import { paypalSdk } from "../paypal/sdk";
import type { AgentStep } from "./agent";
import { fakeAiEnabled, modelFor, openai } from "./client";
import { fakeRescueClient } from "./fake-client";
import { allowedFixes, briefFor, planRescue, standardNote, type CaseFile as AgentCase } from "./rescue-agent";

export type { RescuePlan } from "./rescue-agent";

type CaseFile = Omit<AgentCase, "failure" | "donor"> & { failure: typeof s.failures.$inferSelect; donor: typeof s.donors.$inferSelect };

async function load(failureId: string): Promise<CaseFile> {
  const failure = await db.query.failures.findFirst({ where: eq(s.failures.id, failureId), with: { donor: true, org: true } });
  if (!failure) throw new Error("Failure not found");
  const gifts = await db.query.gifts.findMany({ where: eq(s.gifts.donorId, failure.donorId), orderBy: asc(s.gifts.chargedAt) });
  const past = await db.query.failures.findMany({ where: and(eq(s.failures.donorId, failure.donorId), ne(s.failures.id, failure.id)) });
  return { failure, donor: failure.donor, orgName: failure.org.name, gifts: gifts.map((g) => ({ at: g.chargedAt, cents: g.amountCents })), past: past.map((p) => ({ failedAt: p.failedAt, status: p.status, chosenFix: p.chosenFix })) };
}

async function addStep(failureId: string, step: AgentStep) {
  const row = await db.query.failures.findFirst({ where: eq(s.failures.id, failureId), columns: { trace: true } });
  await db.update(s.failures).set({ trace: [...(row?.trace ?? []), { tool: step.tool, label: step.label, turn: step.turn, detail: step.detail, plan: step.plan, at: new Date().toISOString() }] }).where(eq(s.failures.id, failureId));
}

/** Diagnoses a failed gift with the agent and stores the result for the officer's approval. */
export async function diagnose(failureId: string, opts: { client?: OpenAI; paypal?: () => PaypalClient } = {}) {
  const c = await load(failureId);
  const fake = !opts.client && fakeAiEnabled();
  const model = fake ? "fake-local" : modelFor("rescue");
  await db.update(s.failures).set({ status: "diagnosing", trace: [], error: null, model }).where(eq(s.failures.id, failureId));
  const first = c.donor.name.split(" ")[0];
  // What Sam told Lifeline AI about this donor ("Cora lost her job") shapes the fix and the note.
  const memos = await db.select({ text: s.memos.text }).from(s.memos).where(eq(s.memos.donorId, c.donor.id)).orderBy(desc(s.memos.createdAt)).limit(10);
  const memoTexts = memos.map((m) => m.text);
  const brief = briefFor(c, memoTexts);

  try {
    const { run, rescue: r, fixes, recommended } = await planRescue(c, {
      client: opts.client ?? (fake ? fakeRescueClient(first) : openai()),
      model,
      paypal: opts.paypal ?? paypalSdk,
      memos: memoTexts,
      onStep: (step: AgentStep) => addStep(failureId, step),
    });
    await db
      .update(s.failures)
      .set({ status: "awaiting_approval", diagnosis: { cause: r.cause, summary: plainWords(r.summary), confidence: r.confidence }, fixes, recommendedFix: recommended })
      .where(eq(s.failures.id, failureId));
    await db.delete(s.notes).where(and(eq(s.notes.failureId, failureId), eq(s.notes.status, "draft")));
    await db.insert(s.notes).values({ failureId, to: c.donor.email, subject: r.note_subject.slice(0, 120), body: r.note_body });
    await db.insert(s.audit).values({
      orgId: c.failure.orgId,
      kind: "ai.rescue.diagnose",
      subjectType: "failure",
      subjectId: failureId,
      model: run.model,
      inputHash: createHash("sha256").update(JSON.stringify(brief)).digest("hex").slice(0, 16),
      output: { ...r, kept: fixes, recommended, tools: run.tools, ms: run.ms, usage: run.usage },
    });
    return { ok: true as const, ms: run.ms };
  } catch (e) {
    const message = e instanceof Error ? e.message : "The agent failed";
    await db.update(s.failures).set({ status: "awaiting_approval", error: message, diagnosis: { cause: "unclear", summary: `${first}'s gift failed (${causeLabel(c.failure.reasonCode).toLowerCase()}). Lifeline AI couldn't finish looking into it, so here are the standard fixes.`, confidence: "low" }, fixes: [...allowedFixes(c, null)], recommendedFix: "note" }).where(eq(s.failures.id, failureId));
    await db.delete(s.notes).where(and(eq(s.notes.failureId, failureId), eq(s.notes.status, "draft")));
    const std = standardNote(c);
    await db.insert(s.notes).values({ failureId, to: c.donor.email, subject: std.note_subject, body: std.note_body });
    await addStep(failureId, { tool: "fallback", label: "AI unavailable: offered the standard fixes", turn: 0 });
    return { ok: false as const, error: message };
  }
}
