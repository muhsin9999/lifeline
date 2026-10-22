"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { FIXES, type FixId } from "@/lib/fixes";
import { diagnose } from "@/server/ai/rescue";
import { runFix, type FixResult } from "@/server/paypal/actions";
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
  const result = await runFix({ orgId: org.id, approvedBy: "Tunde (fundraising officer)", ...parsed.data });
  revalidatePath("/rescues", "layout");
  return result;
}

/** Runs the agent again on a rescue (after a failure, or when the officer wants a fresh look). */
export async function lookAgain(failureId: string) {
  if (!z.uuid().safeParse(failureId).success) return;
  await currentOrg();
  after(() => diagnose(failureId).then(() => undefined));
  revalidatePath(`/rescues/${failureId}`);
}
