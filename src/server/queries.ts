// Read models for the app's pages. Everything shown is computed from Lifeline's own rows, which mirror PayPal.
import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, notInArray, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";

const OPEN = ["new", "diagnosing", "awaiting_approval", "acting"] as const;
const CLOSED = ["recovered", "lost", "cancelled", "paused"];

/** The nonprofit this deployment serves (one food bank per deployment). */
export async function currentOrg() {
  const org = await db.query.orgs.findFirst({ where: eq(s.orgs.slug, process.env.ORG_SLUG || "larkhaven") });
  if (!org) throw new Error("No organisation found: run the seed");
  return org;
}

const monthStart = (d: Date, offset = 0) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));

export async function getKpis(orgId: string, now: Date) {
  const thisMonth = monthStart(now);
  const lastMonth = monthStart(now, -1);
  const [committed] = await db
    .select({ cents: sql<number>`coalesce(sum(${s.donors.amountCents}), 0)::int`, donors: sql<number>`count(*)::int` })
    .from(s.donors)
    .where(and(eq(s.donors.orgId, orgId), eq(s.donors.status, "ACTIVE")));
  const [atRisk] = await db
    .select({ cents: sql<number>`coalesce(sum(${s.failures.amountCents}), 0)::int`, count: sql<number>`count(*)::int` })
    .from(s.failures)
    .where(and(eq(s.failures.orgId, orgId), inArray(s.failures.status, [...OPEN])));
  const recoveredIn = async (from: Date, to: Date) => {
    const [r] = await db
      .select({ cents: sql<number>`coalesce(sum(${s.failures.recoveredCents}), 0)::int`, count: sql<number>`count(*)::int` })
      .from(s.failures)
      .where(and(eq(s.failures.orgId, orgId), eq(s.failures.status, "recovered"), gte(s.failures.resolvedAt, from), lt(s.failures.resolvedAt, to)));
    return r;
  };
  const recovered = await recoveredIn(thisMonth, monthStart(now, 1));
  const recoveredBefore = await recoveredIn(lastMonth, thisMonth);
  // Recovery rate over the last 90 days: failures brought back ÷ all failures in that window.
  const since = new Date(now.getTime() - 90 * 86_400_000);
  const [rate] = await db
    .select({ all: sql<number>`count(*)::int`, recovered: sql<number>`count(*) filter (where ${s.failures.status} = 'recovered')::int` })
    .from(s.failures)
    .where(and(eq(s.failures.orgId, orgId), gte(s.failures.failedAt, since)));
  return {
    monthlyGiving: { cents: committed.cents, donors: committed.donors },
    atRisk: { cents: atRisk.cents, count: atRisk.count },
    recovered: { cents: recovered.cents, count: recovered.count, lastMonthCents: recoveredBefore.cents },
    recoveryRate: { recovered: rate.recovered, all: rate.all },
  };
}
export type Kpis = Awaited<ReturnType<typeof getKpis>>;

/** One entry per day in the window: what was given, what failed and what was recovered, with the donors behind it. */
export async function getPulse(orgId: string, now: Date, days: number) {
  const from = new Date(now.getTime() - days * 86_400_000);
  const gifts = await db
    .select({ at: s.gifts.chargedAt, cents: s.gifts.amountCents, recovered: s.gifts.recoveredFailureId, donor: s.donors.name })
    .from(s.gifts)
    .innerJoin(s.donors, eq(s.donors.id, s.gifts.donorId))
    .where(and(eq(s.gifts.orgId, orgId), gte(s.gifts.chargedAt, from)))
    .orderBy(asc(s.gifts.chargedAt));
  const failed = await db
    .select({ at: s.failures.failedAt, cents: s.failures.amountCents, status: s.failures.status, donor: s.donors.name })
    .from(s.failures)
    .innerJoin(s.donors, eq(s.donors.id, s.failures.donorId))
    .where(and(eq(s.failures.orgId, orgId), gte(s.failures.failedAt, from)));
  return {
    from: from.toISOString(),
    to: now.toISOString(),
    gifts: gifts.map((g) => ({ at: g.at.toISOString(), cents: g.cents, donor: g.donor, recovered: !!g.recovered })),
    failures: failed.map((f) => ({ at: f.at.toISOString(), cents: f.cents, donor: f.donor, status: f.status })),
  };
}
export type Pulse = Awaited<ReturnType<typeof getPulse>>;

/** Failed gifts still waiting on the officer or the agent, newest first. */
export async function getNeedsYou(orgId: string) {
  return db.query.failures.findMany({
    where: and(eq(s.failures.orgId, orgId), inArray(s.failures.status, [...OPEN])),
    with: { donor: true },
    orderBy: desc(s.failures.failedAt),
  });
}

/** Rescues closed recently, for the "done" section under the list. */
export async function getRecentlyClosed(orgId: string, limit = 4) {
  return db.query.failures.findMany({
    where: and(eq(s.failures.orgId, orgId), notInArray(s.failures.status, [...OPEN]), inArray(s.failures.status, CLOSED)),
    with: { donor: true },
    orderBy: desc(s.failures.resolvedAt),
    limit,
  });
}

export async function getRescue(orgId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const failure = await db.query.failures.findFirst({
    where: and(eq(s.failures.orgId, orgId), eq(s.failures.id, id)),
    with: { donor: { with: { gifts: { orderBy: asc(s.gifts.chargedAt) } } }, notes: { orderBy: desc(s.notes.createdAt), limit: 1 } },
  });
  return failure ?? null;
}
export type Rescue = NonNullable<Awaited<ReturnType<typeof getRescue>>>;
