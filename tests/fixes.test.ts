// The approved fixes against a fake PayPal, the way the APIMatic plugin's testing skill describes: the real SDK
// over a fake `fetch` answering in PayPal's wire shape, and the real claims table on the Neon `dev` branch, so a
// test can see the claim was committed before the request left. Cases are the rows of paypal-plan.md §1b.
import { eq } from "drizzle-orm";
import { PaypalClient } from "paypal";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
try {
  process.loadEnvFile(".env.local");
} catch {}
const host = (u?: string) => (u ? new URL(u).host : "");
const live = !process.env.DATABASE_URL || host(process.env.DATABASE_URL) === host(process.env.DATABASE_URL_PROD);
process.env.RESEND_API_KEY = "";

const { db, schema: s } = await import("../src/db");
const { resumeGift, runFix } = await import("../src/server/paypal/actions");

type Reply = { status: number; body?: unknown } | "drop";
type Call = { method: string; path: string; headers: Headers; body: unknown; claimAtSend?: string | null };
const TOKEN = { status: 200, body: { access_token: "tok", token_type: "Bearer", expires_in: 3600 } };
const SUB = "I-TESTSUB";

/** A fake PayPal routed on method + path; a list answers in order (the last one repeats). */
function fakePayPal(routes: Record<string, Reply | Reply[]>, opts: { claimKey?: string } = {}) {
  const calls: Call[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    const path = new URL(req.url).pathname;
    const text = req.body ? await req.clone().text() : "";
    const call: Call = { method: req.method, path, headers: req.headers, body: text && path !== "/v1/oauth2/token" ? JSON.parse(text) : null };
    if (opts.claimKey && req.method !== "GET" && path !== "/v1/oauth2/token") {
      const row = await db.query.paypalActions.findFirst({ where: eq(s.paypalActions.claimKey, opts.claimKey) });
      call.claimAtSend = row?.status ?? null;
    }
    calls.push(call);
    const route = routes[`${req.method} ${path}`] ?? (path === "/v1/oauth2/token" ? TOKEN : { status: 404, body: { name: "RESOURCE_NOT_FOUND", message: "no route", debug_id: "dbg-404" } });
    const r = Array.isArray(route) ? (route.length > 1 ? route.shift()! : route[0]) : route;
    if (r === "drop") throw new TypeError("fetch failed: socket hang up");
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json" } });
  };
  const client = new PaypalClient({ fetch, oauth2: { clientId: "id", clientSecret: "secret" }, retry: { maxRetries: 0 }, logging: { level: "off" } });
  return { client, calls, writes: () => calls.filter((c) => c.method !== "GET" && c.path !== "/v1/oauth2/token"), reads: () => calls.filter((c) => c.method === "GET") };
}

const subscription = (o: { owed?: string; status?: string; lastPaid?: string; price?: string } = {}) => ({
  id: SUB,
  status: o.status ?? "ACTIVE",
  billing_info: { outstanding_balance: { currency_code: "USD", value: o.owed ?? "25.00" }, failed_payments_count: 1, ...(o.lastPaid && { last_payment: { amount: { currency_code: "USD", value: "25.00" }, time: o.lastPaid } }) },
  plan: { billing_cycles: [{ sequence: 1, tenure_type: "REGULAR", frequency: { interval_unit: "MONTH" }, pricing_scheme: { fixed_price: { currency_code: "USD", value: o.price ?? "25.00" } } }] },
});
const paypalError = (status: number, name: string, description?: string) => ({ status, body: { name, message: "The requested action could not be performed.", debug_id: "dbg-1", ...(description && { details: [{ issue: name, description }] }) } });

let ids: { orgId: string; failureId: string; otherOrgFailureId: string };
const slug = `test-${Date.now()}`;

async function setup() {
  await db.delete(s.orgs).where(eq(s.orgs.slug, slug));
  await db.delete(s.orgs).where(eq(s.orgs.slug, `${slug}-other`));
  const [org] = await db.insert(s.orgs).values({ slug, name: "Test Food Bank" }).returning();
  const [donor] = await db.insert(s.donors).values({ orgId: org.id, key: `${slug}-d`, name: "Grace Test", email: "grace@example.org", amountCents: 2500, paypalSubscriptionId: SUB, status: "ACTIVE" }).returning();
  const [failure] = await db.insert(s.failures).values({ orgId: org.id, donorId: donor.id, status: "awaiting_approval", amountCents: 2500, failedAt: new Date(), fixes: ["note", "retry", "pause", "lower", "forgive"], recommendedFix: "note" }).returning();
  const [other] = await db.insert(s.orgs).values({ slug: `${slug}-other`, name: "Other" }).returning();
  const [od] = await db.insert(s.donors).values({ orgId: other.id, key: `${slug}-od`, name: "Other Donor", email: "o@example.org", amountCents: 2500, paypalSubscriptionId: "I-OTHER" }).returning();
  const [of] = await db.insert(s.failures).values({ orgId: other.id, donorId: od.id, status: "awaiting_approval", amountCents: 2500, failedAt: new Date(), fixes: ["retry"] }).returning();
  ids = { orgId: org.id, failureId: failure.id, otherOrgFailureId: of.id };
}

describe.skipIf(live)("approved fixes against a fake PayPal (dev database)", () => {
  beforeEach(setup, 30_000);
  afterAll(async () => {
    await db.delete(s.orgs).where(eq(s.orgs.slug, slug));
    await db.delete(s.orgs).where(eq(s.orgs.slug, `${slug}-other`));
  }, 30_000);
  const fix = (f: Parameters<typeof runFix>[0]["fix"], extra: Partial<Parameters<typeof runFix>[0]> = {}) => ({ orgId: ids.orgId, failureId: ids.failureId, fix: f, approvedBy: "test", ...extra });

  it("retry: claims before the capture leaves, sends only the plan's fields, and records the recovered gift", async () => {
    const pp = fakePayPal(
      {
        [`GET /v1/billing/subscriptions/${SUB}`]: { status: 200, body: subscription() },
        [`POST /v1/billing/subscriptions/${SUB}/capture`]: { status: 202, body: { id: "TX-1", status: "COMPLETED", amount_with_breakdown: { gross_amount: { currency_code: "USD", value: "25.00" } }, time: new Date().toISOString() } },
      },
      { claimKey: `retry:${ids.failureId}` },
    );
    const r = await runFix(fix("retry"), pp.client);
    expect(r).toMatchObject({ ok: true });
    const [w] = pp.writes();
    expect(w.claimAtSend).toBe("claimed");
    expect(w.body).toEqual({ note: "Monthly gift retried by Lifeline after approval", capture_type: "OUTSTANDING_BALANCE", amount: { currency_code: "USD", value: "25.00" } });
    const claim = await db.query.paypalActions.findFirst({ where: eq(s.paypalActions.claimKey, `retry:${ids.failureId}`) });
    expect(w.headers.get("paypal-request-id")).toBe(claim!.id);
    expect(claim!.status).toBe("done");
    expect(await db.query.gifts.findFirst({ where: eq(s.gifts.paypalTransactionId, "TX-1") })).toMatchObject({ recoveredFailureId: ids.failureId });
    expect((await db.query.failures.findFirst({ where: eq(s.failures.id, ids.failureId) }))!.status).toBe("recovered");
  }, 60_000);

  it("retry: a dropped capture is settled by re-reading PayPal, and confirmed when PayPal shows it paid", async () => {
    const pp = fakePayPal({
      [`GET /v1/billing/subscriptions/${SUB}`]: [{ status: 200, body: subscription() }, { status: 200, body: subscription({ owed: "0.00", lastPaid: new Date(Date.now() + 60_000).toISOString() }) }],
      [`POST /v1/billing/subscriptions/${SUB}/capture`]: "drop",
    });
    const r = await runFix(fix("retry"), pp.client);
    expect(r).toEqual({ ok: true, message: "PayPal confirms this went through." });
    expect(pp.reads()).toHaveLength(2); // the owed read, then the re-read after the lost answer
  }, 60_000);

  it("retry: a dropped capture PayPal can't confirm stays unknown, never 'failed', and blocks a second capture", async () => {
    const pp = fakePayPal({ [`GET /v1/billing/subscriptions/${SUB}`]: { status: 200, body: subscription() }, [`POST /v1/billing/subscriptions/${SUB}/capture`]: "drop" });
    const r = await runFix(fix("retry"), pp.client);
    expect(r).toMatchObject({ ok: false, pending: true });
    expect((await db.query.paypalActions.findFirst({ where: eq(s.paypalActions.claimKey, `retry:${ids.failureId}`) }))!.status).toBe("unknown");
    const again = await runFix(fix("retry"), pp.client);
    expect(again).toMatchObject({ ok: false, pending: true });
    expect(pp.writes()).toHaveLength(1); // the second click re-read PayPal instead of capturing again
  }, 60_000);

  it.each([
    ["pause", `POST /v1/billing/subscriptions/${SUB}/suspend`, subscription({ status: "SUSPENDED" }), {}],
    ["forgive", `PATCH /v1/billing/subscriptions/${SUB}`, subscription({ owed: "0.00" }), {}],
    ["lower", `PATCH /v1/billing/subscriptions/${SUB}`, subscription({ price: "15.00" }), { newAmountCents: 1500 }],
  ] as const)("%s: a dropped write is re-read, and counts as done only when PayPal shows it", async (f, route, after, extra) => {
    const pp = fakePayPal({ [route]: "drop", [`GET /v1/billing/subscriptions/${SUB}`]: { status: 200, body: after } });
    expect(await runFix(fix(f, extra), pp.client)).toEqual({ ok: true, message: "PayPal confirms this went through." });
    expect(pp.reads()).toHaveLength(1);
    const unconfirmed = fakePayPal({ [route]: "drop", [`GET /v1/billing/subscriptions/${SUB}`]: { status: 200, body: subscription() } });
    await setup(); // fresh rescue: the first half changed the donor
    expect(await runFix(fix(f, extra), unconfirmed.client)).toMatchObject({ ok: false, pending: true });
  }, 60_000);

  it("pause: a refused credential means nothing was sent, so there is no re-read and the claim is released", async () => {
    const pp = fakePayPal({ "POST /v1/oauth2/token": { status: 401, body: { error: "invalid_client" } } });
    const r = await runFix(fix("pause"), pp.client);
    expect(r).toMatchObject({ ok: false, status: 500 });
    expect(pp.reads()).toHaveLength(0);
    expect(await db.query.paypalActions.findFirst({ where: eq(s.paypalActions.claimKey, `pause:${ids.failureId}`) })).toBeUndefined();
  }, 60_000);

  it("pause: PayPal's 422 reason reaches the officer, with the same status", async () => {
    const pp = fakePayPal({ [`POST /v1/billing/subscriptions/${SUB}/suspend`]: paypalError(422, "SUBSCRIPTION_STATUS_INVALID", "Invalid subscription status for suspend action; subscription status should be active.") });
    const r = await runFix(fix("pause"), pp.client);
    expect(r).toEqual({ ok: false, status: 422, message: "Invalid subscription status for suspend action; subscription status should be active." });
    expect(await db.query.paypalActions.findFirst({ where: eq(s.paypalActions.claimKey, `pause:${ids.failureId}`) })).toBeUndefined();
  }, 60_000);

  it("pause: PayPal's 401 is our credentials, answered as 502 with a fixed message", async () => {
    const pp = fakePayPal({ [`POST /v1/billing/subscriptions/${SUB}/suspend`]: paypalError(401, "AUTHENTICATION_FAILURE") });
    expect(await runFix(fix("pause"), pp.client)).toEqual({ ok: false, status: 502, message: "Lifeline couldn’t sign in to PayPal." });
  }, 60_000);

  it("lower: patches only the first cycle's price, under PayPal's wire names", async () => {
    const pp = fakePayPal({ [`PATCH /v1/billing/subscriptions/${SUB}`]: { status: 204 } });
    expect(await runFix(fix("lower", { newAmountCents: 1500 }), pp.client)).toMatchObject({ ok: true });
    const [w] = pp.writes();
    expect(w.body).toEqual([{ op: "replace", path: "/plan/billing_cycles/@sequence==1/pricing_scheme/fixed_price", value: { currency_code: "USD", value: "15.00" } }]);
    expect(w.headers.get("paypal-request-id")).toBeNull(); // the operation has no such field (1b.3)
  }, 60_000);

  it("a fix that wasn't offered, or a rescue from another organisation, never reaches PayPal", async () => {
    const pp = fakePayPal({});
    expect(await runFix(fix("cancel"), pp.client)).toMatchObject({ ok: false, status: 400 });
    expect(await runFix({ ...fix("retry"), failureId: ids.otherOrgFailureId }, pp.client)).toMatchObject({ ok: false, status: 404 });
    expect(await runFix(fix("lower", { newAmountCents: 9900 }), pp.client)).toMatchObject({ ok: false, status: 400 });
    expect(pp.calls).toHaveLength(0);
  }, 60_000);

  it("a second click after a fix is done does nothing", async () => {
    const pp = fakePayPal({ [`POST /v1/billing/subscriptions/${SUB}/suspend`]: { status: 204 } });
    expect(await runFix(fix("pause"), pp.client)).toMatchObject({ ok: true });
    expect(await runFix(fix("pause"), pp.client)).toEqual({ ok: true, message: "Already done." });
    expect(pp.writes()).toHaveLength(1);
  }, 60_000);
  it("resume: only a paused rescue, claimed before the activate call, with a reason; the rescue goes back to watching", async () => {
    const pp = fakePayPal({ [`POST /v1/billing/subscriptions/${SUB}/suspend`]: { status: 204 }, [`POST /v1/billing/subscriptions/${SUB}/activate`]: { status: 204 } }, { claimKey: `resume:${ids.failureId}` });
    const resume = () => resumeGift({ orgId: ids.orgId, failureId: ids.failureId, approvedBy: "test" }, pp.client);
    expect(await resume()).toMatchObject({ ok: false, status: 409 }); // not paused yet
    expect(pp.calls).toHaveLength(0);
    expect(await runFix(fix("pause"), pp.client)).toMatchObject({ ok: true });
    expect(await resume()).toEqual({ ok: true, message: "Grace's monthly gift is back on." });
    const w = pp.writes().at(-1)!;
    expect(w.path).toBe(`/v1/billing/subscriptions/${SUB}/activate`);
    expect(w.body).toEqual({ reason: "Resumed by the nonprofit" });
    expect(w.claimAtSend).toBe("claimed");
    const f = await db.query.failures.findFirst({ where: eq(s.failures.id, ids.failureId), with: { donor: true } });
    expect(f!.status).toBe("watching");
    expect(f!.resolvedAt).toBeNull();
    expect(f!.donor.status).toBe("ACTIVE");
    expect(await resume()).toMatchObject({ ok: false, status: 409 }); // watching again, nothing to resume
    expect(pp.writes()).toHaveLength(2);
  }, 60_000);

  it("resume: a gift PayPal suspended after failed payments can be resumed from its open rescue, which stays open", async () => {
    await db.update(s.donors).set({ status: "SUSPENDED" }).where(eq(s.donors.paypalSubscriptionId, SUB));
    const pp = fakePayPal({ [`POST /v1/billing/subscriptions/${SUB}/activate`]: { status: 204 } });
    expect(await resumeGift({ orgId: ids.orgId, failureId: ids.failureId, approvedBy: "test" }, pp.client)).toMatchObject({ ok: true });
    const f = await db.query.failures.findFirst({ where: eq(s.failures.id, ids.failureId), with: { donor: true } });
    expect(f!.status).toBe("awaiting_approval");
    expect(f!.donor.status).toBe("ACTIVE");
  }, 60_000);

  it("resume: a dropped activate is settled by re-reading PayPal", async () => {
    const pp = fakePayPal({ [`POST /v1/billing/subscriptions/${SUB}/suspend`]: { status: 204 }, [`POST /v1/billing/subscriptions/${SUB}/activate`]: "drop", [`GET /v1/billing/subscriptions/${SUB}`]: { status: 200, body: subscription({ status: "ACTIVE" }) } });
    await runFix(fix("pause"), pp.client);
    expect(await resumeGift({ orgId: ids.orgId, failureId: ids.failureId, approvedBy: "test" }, pp.client)).toEqual({ ok: true, message: "PayPal confirms this went through." });
    expect(pp.reads()).toHaveLength(1);
  }, 60_000);

  it("resume: a rescue from another organisation never reaches PayPal", async () => {
    const pp = fakePayPal({});
    expect(await resumeGift({ orgId: ids.orgId, failureId: ids.otherOrgFailureId, approvedBy: "test" }, pp.client)).toMatchObject({ ok: false, status: 404 });
    expect(pp.calls).toHaveLength(0);
  }, 60_000);
});
