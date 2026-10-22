// Adds real PayPal sandbox subscriptions to Lifeline as donors, with their real gift history, read from PayPal.
// Nothing is invented: the donor's name and email are the sandbox subscriber's, and every gift is a PayPal
// transaction. Usage: tsx --conditions=react-server --env-file=.env.local scripts/link-subscriptions.ts [--prod] I-AAA I-BBB
import "../src/lib/net";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { PaypalClient } from "paypal";
import * as s from "../src/db/schema";

const prod = process.argv.includes("--prod");
const ids = process.argv.slice(2).filter((a) => a.startsWith("I-"));
const url = prod ? process.env.DATABASE_URL_PROD : process.env.DATABASE_URL;
if (!url || !ids.length) throw new Error("Usage: link-subscriptions.ts [--prod] I-…");
const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
const db = drizzle(client, { schema: s });
const paypal = new PaypalClient({ oauth2: { clientId: process.env.PAYPAL_CLIENT_ID!, clientSecret: process.env.PAYPAL_CLIENT_SECRET! }, logging: { level: "off" } });

const cents = (v?: string) => (v ? Math.round(Number(v) * 100) : null);

let org = await db.query.orgs.findFirst({ where: eq(s.orgs.slug, "larkhaven") });
if (org && prod === false && (await db.query.donors.findFirst({ where: eq(s.donors.orgId, org.id) }))?.paypalSubscriptionId?.startsWith("FIXTURE-"))
  throw new Error("The dev database holds design fixtures for this org; link real subscriptions to --prod (or clear the fixtures first)");
org ??= (await db.insert(s.orgs).values({ slug: "larkhaven", name: "Larkhaven Food Bank" }).returning())[0];

for (const id of ids) {
  const sub = await paypal.subscriptions.getSubscription({ id });
  const status = (sub as { status?: unknown }).status;
  const who = sub.subscriber;
  const name = [who?.name?.givenName, who?.name?.surname].filter(Boolean).join(" ") || "Sandbox donor";
  const email = who?.emailAddress ?? "unknown@sandbox";
  const start = sub.startTime ? new Date(sub.startTime) : new Date(Date.now() - 86_400_000);
  const txs = await paypal.subscriptions.listSubscriptionTransactions({ id, startTime: new Date(start.getTime() - 86_400_000).toISOString(), endTime: new Date().toISOString() });
  const paid = (txs.transactions ?? []).filter((t) => (t.status ?? "COMPLETED") === "COMPLETED");
  const amount = cents(sub.billingInfo?.lastPayment?.amount?.value) ?? cents(paid[0]?.amountWithBreakdown.grossAmount.value) ?? 0;

  const [donor] = await db
    .insert(s.donors)
    .values({ orgId: org.id, key: id, name, email, amountCents: amount, paypalSubscriptionId: id, status: typeof status === "string" ? status : "ACTIVE", startedAt: start, lastPaymentAt: sub.billingInfo?.lastPayment?.time ? new Date(sub.billingInfo.lastPayment.time) : null, failedPaymentsCount: sub.billingInfo?.failedPaymentsCount ?? 0, syncedAt: new Date() })
    .onConflictDoUpdate({ target: s.donors.key, set: { name, email, amountCents: amount, status: typeof status === "string" ? status : "ACTIVE", syncedAt: new Date() } })
    .returning();
  for (const t of paid)
    await db.insert(s.gifts).values({ orgId: org.id, donorId: donor.id, paypalTransactionId: t.id, amountCents: cents(t.amountWithBreakdown.grossAmount.value) ?? amount, chargedAt: new Date(t.time) }).onConflictDoNothing({ target: s.gifts.paypalTransactionId });
  console.log(`${id}: ${name} · ${status} · ${paid.length} gift(s) · $${(amount / 100).toFixed(2)}/period`);
}
await client.end();
