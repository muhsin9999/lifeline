// Practice copies (server/workspace.ts) on the Neon `dev` branch: a visitor's copy is complete and separate, fixes
// that would change PayPal are shown but never sent, and PayPal's webhooks only ever touch the real food bank.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { PaypalClient } from "paypal";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
try {
  process.loadEnvFile(".env.local");
} catch {}
const host = (u?: string) => (u ? new URL(u).host : "");
const live = !process.env.DATABASE_URL || host(process.env.DATABASE_URL) === host(process.env.DATABASE_URL_PROD);
process.env.RESEND_API_KEY = "";

const { db, schema: s } = await import("../src/db");
const { copyOrg } = await import("../src/server/workspace");
const { resumeGift, runFix } = await import("../src/server/paypal/actions");
const { ingest } = await import("../src/server/paypal/webhooks");

const SUB = `I-COPY${Date.now()}`;
const slug = `test-copies-${Date.now()}`;
type Call = { method: string; path: string };

function fakePayPal() {
  const calls: Call[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    const path = new URL(req.url).pathname;
    calls.push({ method: req.method, path });
    if (path === "/v1/oauth2/token") return Response.json({ access_token: "tok", token_type: "Bearer", expires_in: 3600 });
    if (req.method === "GET")
      return Response.json({
        id: SUB,
        status: "SUSPENDED",
        billing_info: { outstanding_balance: { currency_code: "USD", value: "25.00" }, failed_payments_count: 3 },
        plan: { billing_cycles: [{ sequence: 1, tenure_type: "REGULAR", frequency: { interval_unit: "MONTH" }, pricing_scheme: { fixed_price: { currency_code: "USD", value: "25.00" } } }] },
      });
    return new Response(null, { status: 204 });
  };
  const client = new PaypalClient({ fetch, oauth2: { clientId: "id", clientSecret: "secret" }, retry: { maxRetries: 0 }, logging: { level: "off" } });
  return { client, writes: () => calls.filter((c) => c.method !== "GET" && c.path !== "/v1/oauth2/token"), reads: () => calls.filter((c) => c.method === "GET") };
}

let real: typeof s.orgs.$inferSelect;
let copy: typeof s.orgs.$inferSelect;
let realFailureId: string;
let copyFailureId: string;

describe.skipIf(live)("practice copies (dev database)", () => {
  beforeAll(async () => {
    [real] = await db.insert(s.orgs).values({ slug, name: "Copy Test Food Bank" }).returning();
    const [donor] = await db.insert(s.donors).values({ orgId: real.id, key: `${slug}-d`, name: "Cora Test", email: "cora@example.org", amountCents: 2500, paypalSubscriptionId: SUB, status: "SUSPENDED", outstandingCents: 2500 }).returning();
    const [failure] = await db.insert(s.failures).values({ orgId: real.id, donorId: donor.id, status: "awaiting_approval", amountCents: 2500, failedAt: new Date(), fixes: ["note", "retry", "pause"], recommendedFix: "pause", diagnosis: { cause: "card", summary: "Card declined", confidence: "high" } }).returning();
    realFailureId = failure.id;
    await db.insert(s.gifts).values({ orgId: real.id, donorId: donor.id, paypalTransactionId: `TX-${slug}`, amountCents: 2500, chargedAt: new Date() });
    await db.insert(s.notes).values({ failureId: failure.id, to: "cora@example.org", subject: "Hi", body: "Your gift" });
    copy = await copyOrg(real, randomUUID());
    copyFailureId = (await db.query.failures.findFirst({ where: eq(s.failures.orgId, copy.id) }))!.id;
  }, 60_000);
  afterAll(async () => {
    await db.delete(s.orgs).where(eq(s.orgs.slug, slug)); // the copy cascades with it
  }, 30_000);

  it("copies every donor, gift, rescue and note with fresh ids, keeping the real PayPal ids", async () => {
    expect(copy.copyOf).toBe(real.id);
    const donor = await db.query.donors.findFirst({ where: eq(s.donors.orgId, copy.id) });
    expect(donor).toMatchObject({ paypalSubscriptionId: SUB, name: "Cora Test" });
    expect(await db.query.gifts.findFirst({ where: and(eq(s.gifts.orgId, copy.id), eq(s.gifts.paypalTransactionId, `TX-${slug}`)) })).toMatchObject({ donorId: donor!.id });
    const failure = await db.query.failures.findFirst({ where: eq(s.failures.id, copyFailureId) });
    expect(failure).toMatchObject({ donorId: donor!.id, status: "awaiting_approval", diagnosis: { summary: "Card declined" } });
    expect(copyFailureId).not.toBe(realFailureId);
    expect(await db.query.notes.findFirst({ where: eq(s.notes.failureId, copyFailureId) })).toMatchObject({ subject: "Hi" });
  });

  it("a fix that would change PayPal is shown, not sent, and only the visitor's copy moves on", async () => {
    const pp = fakePayPal();
    const r = await runFix({ orgId: copy.id, failureId: copyFailureId, fix: "pause", approvedBy: "judge" }, pp.client);
    expect(r).toEqual({ ok: true, message: `Practice copy, so PayPal wasn't changed. Live, Lifeline would pause the gift (POST /v1/billing/subscriptions/${SUB}/suspend).` });
    expect(pp.writes()).toHaveLength(0);
    expect((await db.query.failures.findFirst({ where: eq(s.failures.id, copyFailureId) }))!.status).toBe("paused");
    expect((await db.query.failures.findFirst({ where: eq(s.failures.id, realFailureId) }))!.status).toBe("awaiting_approval");
    const claim = await db.query.paypalActions.findFirst({ where: eq(s.paypalActions.claimKey, `pause:${copyFailureId}`) });
    expect(claim).toMatchObject({ status: "done", result: { practice: true } });
  }, 60_000);

  it("retry in a copy reads what PayPal says is owed (a real read) but captures nothing", async () => {
    const other = await copyOrg(real, randomUUID());
    const fid = (await db.query.failures.findFirst({ where: eq(s.failures.orgId, other.id) }))!.id;
    const pp = fakePayPal();
    const r = await runFix({ orgId: other.id, failureId: fid, fix: "retry", approvedBy: "judge" }, pp.client);
    expect(r).toMatchObject({ ok: true, message: expect.stringContaining("charge the $25.00 owed") });
    expect(pp.reads()).toHaveLength(1);
    expect(pp.writes()).toHaveLength(0);
  }, 60_000);

  it("resume in a copy: a gift the officer paused resumes as practice, with nothing sent", async () => {
    const pp = fakePayPal(); // the copy's rescue was paused in the test above
    const r = await resumeGift({ orgId: copy.id, failureId: copyFailureId, approvedBy: "judge" }, pp.client);
    expect(r).toMatchObject({ ok: true, message: expect.stringContaining("/activate") });
    expect(pp.writes()).toHaveLength(0);
  }, 60_000);

  it("resume in a copy checks PayPal first, like the real one: a gift PayPal suspended with money owed is refused", async () => {
    const fresh = await copyOrg(real, randomUUID());
    const fid = (await db.query.failures.findFirst({ where: eq(s.failures.orgId, fresh.id) }))!.id;
    const pp = fakePayPal();
    const r = await resumeGift({ orgId: fresh.id, failureId: fid, approvedBy: "judge" }, pp.client);
    expect(r).toMatchObject({ ok: false, status: 409, message: expect.stringContaining("Retry the charge first") });
    expect(pp.writes()).toHaveLength(0);
  }, 60_000);

  it("PayPal's webhook opens the rescue in the real food bank only, never in a copy", async () => {
    const event = { id: `WH-${slug}`, event_type: "BILLING.SUBSCRIPTION.PAYMENT.FAILED", create_time: new Date().toISOString(), resource: { id: SUB } };
    const r = await ingest(event as never);
    expect(r.outcome).toBe("stored");
    const opened = await db.query.failures.findFirst({ where: eq(s.failures.paypalEventId, event.id) });
    expect(opened!.orgId).toBe(real.id);
    expect(await ingest(event as never)).toMatchObject({ outcome: "duplicate" });
  }, 60_000);
});
