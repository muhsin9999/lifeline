"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { FIXES, type FixId } from "@/lib/fixes";
import { diagnose } from "@/server/ai/rescue";
import { resumeGift, runFix, type FixResult } from "@/server/paypal/actions";
import { currentOrg } from "@/server/queries";

const Approve = z.object({
  failureId: z.uuid(),
  fix: z.enum(Object.keys(FIXES) as [FixId, ...FixId[]]),
  newAmountCents: z.number().int().positive().optional(),
  note: z.object({ subject: z.string().min(1).max(120), body: z.string().min(1).max(2000) }).optional(),
});

/** The officer approves one fix. Only this action, after this click, changes anything on PayPal or emails a donor. */
export async function approveFix(input: z.input<typeof Approve>): Promise<FixResult> {
  const parsed = Approve.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, message: "That request wasn't valid." };
  const org = await currentOrg();
  const result = await runFix({ orgId: org.id, approvedBy: "Sam (fundraising officer)", ...parsed.data });
  revalidatePath("/rescues", "layout");
  return result;
}

/** The officer resumes a gift they paused from this rescue. */
export async function resumeGiftAction(failureId: string): Promise<FixResult> {
  if (!z.uuid().safeParse(failureId).success) return { ok: false, status: 400, message: "That request wasn't valid." };
  const org = await currentOrg();
  const result = await resumeGift({ orgId: org.id, failureId, approvedBy: "Sam (fundraising officer)" });
  revalidatePath("/", "layout");
  return result;
}

/** Runs the agent again on a rescue (after a failure, or when the officer wants a fresh look). */
export async function lookAgain(failureId: string) {
  if (!z.uuid().safeParse(failureId).success) return;
  const org = await currentOrg();
  // Mark it now, so the page switches to its live view before the agent's first step lands.
  await db.update(schema.failures).set({ status: "diagnosing", trace: [], error: null }).where(and(eq(schema.failures.id, failureId), eq(schema.failures.orgId, org.id)));
  after(() => diagnose(failureId).then(() => undefined));
  revalidatePath(`/rescues/${failureId}`);
}
