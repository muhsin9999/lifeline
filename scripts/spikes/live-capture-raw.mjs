// Re-sends ONE subscription capture with the SAME PayPal-Request-Id as Lifeline's claim (idempotent), printing PayPal's
// raw reply. Usage: node --env-file=.env.local scripts/spikes/live-capture-raw.mjs <claimKey>
import "../../src/lib/net.ts";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL_PROD, { max: 1, prepare: false });
const [c] = await sql`select a.id, f.id as fid, d.paypal_subscription_id sub from paypal_actions a join failures f on f.id=a.failure_id join donors d on d.id=f.donor_id where a.claim_key=${process.argv[2]}`;
await sql.end();
const base = "https://api-m.sandbox.paypal.com";
const tok = await (await fetch(`${base}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" })).json();
const t0 = Date.now();
const res = await fetch(`${base}/v1/billing/subscriptions/${c.sub}/capture`, {
  method: "POST",
  headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json", "PayPal-Request-Id": c.id },
  body: JSON.stringify({ note: "Monthly gift retried by Lifeline after approval", capture_type: "OUTSTANDING_BALANCE", amount: { currency_code: "USD", value: "3.00" } }),
});
console.log("status", res.status, `${Date.now() - t0}ms`, "debug", res.headers.get("paypal-debug-id"));
console.log((await res.text()).slice(0, 1500));
