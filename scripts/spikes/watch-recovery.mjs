// Waits (up to 20 min) for Cora's recovery to show: PayPal's subscription read, her transactions, Lifeline's rescue.
import "../../src/lib/net.ts";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL_PROD, { max: 1, prepare: false });
const base = "https://api-m.sandbox.paypal.com";
const token = async () => (await (await fetch(`${base}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" })).json()).access_token;
const SUB = "I-4P1HXE6LTF36", FAILURE = "3b083beb-f43a-450c-b377-46cdea06d175";
const started = Date.now();
while (Date.now() - started < 20 * 60_000) {
  const t = await token();
  const sub = await (await fetch(`${base}/v1/billing/subscriptions/${SUB}`, { headers: { Authorization: `Bearer ${t}` } })).json();
  const tx = await (await fetch(`${base}/v1/billing/subscriptions/${SUB}/transactions?start_time=${new Date(Date.now() - 3 * 864e5).toISOString()}&end_time=${new Date().toISOString()}`, { headers: { Authorization: `Bearer ${t}` } })).json();
  const [f] = await sql`select status, recovered_cents from failures where id=${FAILURE}`;
  const [wh] = await sql`select count(*)::int n from webhook_deliveries where received_at > now() - interval '40 minutes' and type='PAYMENT.SALE.COMPLETED'`;
  const line = `${new Date().toISOString().slice(11, 19)} paypal:${sub.status} owed:${sub.billing_info?.outstanding_balance?.value} last_payment:${sub.billing_info?.last_payment?.time ?? "-"} tx:${(tx.transactions ?? []).map((x) => `${x.status}@${x.time}`).join(",") || "none"} rescue:${f.status} sale_webhooks:${wh.n}`;
  console.log(line);
  if (f.status === "recovered" || Number(sub.billing_info?.outstanding_balance?.value) === 0 || (tx.transactions ?? []).length) break;
  await new Promise((r) => setTimeout(r, 60_000));
}
await sql.end();
