// LOCAL DESIGN WORK ONLY. Fills the Neon `dev` branch with a fictional food bank's donor history so the screens
// can be built and screenshotted before real sandbox history exists. Every id starts with FIXTURE- and the agent
// traces are marked model "dev-fixture". It refuses to run against the live (`main`) database.
// Usage: tsx --env-file=.env.local scripts/dev-fixtures.ts
import "../src/lib/net";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as s from "../src/db/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const host = (u?: string) => (u ? new URL(u).host : "");
if (host(url) === host(process.env.DATABASE_URL_PROD)) throw new Error("Refusing: DATABASE_URL is the live database");

const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
const db = drizzle(client, { schema: s });

// Deterministic, so screenshots are comparable run to run.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const NOW = new Date();
const daysAgo = (d: number, h = 10) => new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate() - d, h));

const DONORS: { name: string; amount: number; months: number; day: number; fate?: "open" | "recovered" | "lost" | "diagnosing" }[] = [
  { name: "Grace Turner", amount: 2500, months: 14, day: 1, fate: "open" },
  { name: "Daniel Hughes", amount: 4000, months: 9, day: 3, fate: "open" },
  { name: "Emily Carter", amount: 1500, months: 22, day: 2, fate: "diagnosing" },
  { name: "Esther Collins", amount: 6000, months: 6, day: 5, fate: "recovered" },
  { name: "Samuel Price", amount: 2000, months: 11, day: 8, fate: "recovered" },
  { name: "Chloe Lewis", amount: 2500, months: 4, day: 12, fate: "lost" },
  { name: "Jordan Miller", amount: 5000, months: 18, day: 15 },
  { name: "Avery Thompson", amount: 1000, months: 7, day: 1 },
  { name: "Priya Raman", amount: 7500, months: 13, day: 20 },
  { name: "Marcus Hill", amount: 2500, months: 16, day: 9 },
  { name: "Lucia Romero", amount: 3500, months: 5, day: 25 },
  { name: "Tom Nolan", amount: 2000, months: 10, day: 18 },
];

await db.delete(s.orgs).where(eq(s.orgs.slug, "larkhaven"));

const [org] = await db.insert(s.orgs).values({ slug: "larkhaven", name: "Larkhaven Food Bank" }).returning();
const [plan] = await db.insert(s.plans).values({ orgId: org.id, slug: "fixture-monthly", name: "Monthly gift", amountCents: 2500 }).returning();

let tx = 0;
for (const [i, d] of DONORS.entries()) {
  const failDay = d.fate ? (d.fate === "open" || d.fate === "diagnosing" ? Math.floor(rand() * 9) : 6 + Math.floor(rand() * 20)) : null;
  const status = d.fate === "lost" ? "CANCELLED" : "ACTIVE";
  const [donor] = await db
    .insert(s.donors)
    .values({
      orgId: org.id,
      planId: plan.id,
      key: `fixture-${i}`,
      name: d.name,
      email: `${d.name.split(" ")[0].toLowerCase()}@example.org`,
      amountCents: d.amount,
      paypalSubscriptionId: `FIXTURE-I-${i}`,
      status,
      startedAt: daysAgo(d.months * 30 + d.day),
      failedPaymentsCount: d.fate && d.fate !== "recovered" ? 1 : 0,
    })
    .returning();

  // One gift a month, on the donor's day, up to (but not including) the failed one.
  const gifts = [];
  for (let m = d.months; m >= 0; m--) {
    const at = daysAgo(m * 30 + ((d.day * 3) % 28), 9 + (i % 8));
    if (at > NOW) continue;
    if (d.fate && failDay !== null && m * 30 + ((d.day * 3) % 28) <= failDay) continue;
    gifts.push({ orgId: org.id, donorId: donor.id, paypalTransactionId: `FIXTURE-TX-${++tx}`, amountCents: d.amount, chargedAt: at });
  }
  if (gifts.length) await db.insert(s.gifts).values(gifts);
  await db.update(s.donors).set({ lastPaymentAt: gifts.at(-1)?.chargedAt ?? null }).where(eq(s.donors.id, donor.id));

  if (!d.fate || failDay === null) continue;
  const failedAt = daysAgo(failDay, 10);
  const recovered = d.fate === "recovered";
  const [failure] = await db
    .insert(s.failures)
    .values({
      orgId: org.id,
      donorId: donor.id,
      paypalEventId: `FIXTURE-WH-${i}`,
      status: recovered ? "recovered" : d.fate === "lost" ? "lost" : d.fate === "diagnosing" ? "diagnosing" : "awaiting_approval",
      amountCents: d.amount,
      reasonCode: "PAYER_CANNOT_PAY",
      failedAt,
      nextRetryAt: daysAgo(failDay - 3, 10),
      model: "dev-fixture",
      ...(d.fate === "open" && {
        diagnosis: { cause: "payment_problem", summary: `PayPal couldn’t take the gift. ${d.name.split(" ")[0]} hasn’t missed one in ${d.months} months, so this looks like a payment problem, not a goodbye.`, confidence: "high" as const },
        fixes: ["note", "retry", "pause", "lower"],
        recommendedFix: "note",
        trace: [
          { tool: "write_plan", label: "Wrote a plan", at: new Date(failedAt.getTime() + 0).toISOString(), plan: ["Read the failed payment PayPal reported", `Check ${d.name.split(" ")[0]}’s giving history`, "See when PayPal retries", "Pick the gentlest fix and draft a note"] },
          { tool: "get_subscription", label: "Read the subscription", at: new Date(failedAt.getTime() + 2500).toISOString(), detail: "Active · 1 failed payment" },
          { tool: "get_failed_payment", label: "Read the failed payment", at: new Date(failedAt.getTime() + 4100).toISOString(), detail: "PAYER_CANNOT_PAY" },
          { tool: "list_gifts", label: "Checked the giving history", at: new Date(failedAt.getTime() + 5700).toISOString(), detail: `${d.months} gifts, none missed` },
          { tool: "check_retry", label: "Checked PayPal’s retry", at: new Date(failedAt.getTime() + 7300).toISOString(), detail: "Next retry in 3 days" },
        ],
      }),
      ...(recovered && { chosenFix: "retry", recoveredCents: d.amount, resolvedAt: daysAgo(Math.max(0, failDay - 2)) }),
    })
    .returning();
  if (recovered)
    await db.insert(s.gifts).values({ orgId: org.id, donorId: donor.id, paypalTransactionId: `FIXTURE-TX-${++tx}`, amountCents: d.amount, chargedAt: daysAgo(Math.max(0, failDay - 2), 15), recoveredFailureId: failure.id });
  if (d.fate === "open")
    await db.insert(s.notes).values({
      failureId: failure.id,
      to: donor.email,
      subject: "Your monthly gift didn’t go through",
      body: `Hi ${d.name.split(" ")[0]},\n\nPayPal couldn’t take this month’s gift to Larkhaven Food Bank. Nothing is wrong on your side that we can see, but updating your payment in PayPal will keep your gift going.\n\nThank you for ${d.months} months of meals.\nSam, Larkhaven Food Bank`,
    });
}

console.log("dev fixtures loaded for", org.name);
await client.end();
