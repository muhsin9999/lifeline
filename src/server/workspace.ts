// Which food bank this request sees. Every visitor gets a private practice copy of the real one, made on their
// first visit, so judges never use up each other's rescues. The copy holds the real PayPal ids, so PayPal reads are
// real; fixes that would change PayPal are shown, not sent (server/paypal/actions.ts). The real workspace, where
// fixes really reach PayPal, opens only with the owner's key (?live=<LIVE_WORKSPACE_KEY>, see src/proxy.ts).
import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, isNotNull, isNull, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, schema as s } from "@/db";

export const VISITOR_COOKIE = "ll_visitor";
export const LIVE_COOKIE = "ll_live";
const COPY_DAYS = 30;

type Org = typeof s.orgs.$inferSelect;

async function realOrg() {
  const org = await db.query.orgs.findFirst({ where: and(eq(s.orgs.slug, process.env.ORG_SLUG || "larkhaven"), isNull(s.orgs.copyOf)) });
  if (!org) throw new Error("No organisation found: run the seed");
  return org;
}

export async function currentOrg(): Promise<Org> {
  const real = await realOrg();
  let jar: Awaited<ReturnType<typeof cookies>>;
  try {
    jar = await cookies();
  } catch {
    return real; // outside a request: scripts and tests
  }
  const live = process.env.LIVE_WORKSPACE_KEY;
  if (live && jar.get(LIVE_COOKIE)?.value === live) return real;
  const key = jar.get(VISITOR_COOKIE)?.value;
  if (!key || !/^[0-9a-f-]{36}$/.test(key)) return real;
  return (await db.query.orgs.findFirst({ where: eq(s.orgs.visitorKey, key) })) ?? copyOrg(real, key);
}

/** True when PayPal-changing fixes must be shown, not sent. */
export const isPractice = (org: Pick<Org, "copyOf">) => !!org.copyOf;

/** Copies the real food bank, row for row with fresh ids, for one visitor. Rescues keep their diagnoses, so no AI runs. */
export async function copyOrg(real: Org, visitorKey: string): Promise<Org> {
  // Copies older than a month are dropped (everything in them cascades).
  await db.delete(s.orgs).where(and(isNotNull(s.orgs.copyOf), lt(s.orgs.createdAt, new Date(Date.now() - COPY_DAYS * 86_400_000))));
  try {
    return await db.transaction(async (tx) => {
      const [org] = await tx.insert(s.orgs).values({ slug: `copy-${visitorKey}`, name: real.name, currency: real.currency, copyOf: real.id, visitorKey }).returning();
      const [donors, gifts, failures, events, audit, memos, actions] = await Promise.all([
        tx.select().from(s.donors).where(eq(s.donors.orgId, real.id)),
        tx.select().from(s.gifts).where(eq(s.gifts.orgId, real.id)),
        tx.select().from(s.failures).where(eq(s.failures.orgId, real.id)),
        tx.select().from(s.events).where(eq(s.events.orgId, real.id)),
        tx.select().from(s.audit).where(eq(s.audit.orgId, real.id)),
        tx.select().from(s.memos).where(eq(s.memos.orgId, real.id)),
        tx.select().from(s.paypalActions).where(eq(s.paypalActions.orgId, real.id)),
      ]);
      const ids = new Map<string, string>();
      const map = (old: string | null) => (old ? (ids.get(old) ?? old) : old);
      for (const r of [...donors, ...failures]) ids.set(r.id, randomUUID());
      const notes = failures.length ? await tx.query.notes.findMany({ where: (n, { inArray }) => inArray(n.failureId, failures.map((f) => f.id)) }) : [];

      if (donors.length) await tx.insert(s.donors).values(donors.map((d) => ({ ...d, id: ids.get(d.id)!, orgId: org.id })));
      if (failures.length) await tx.insert(s.failures).values(failures.map((f) => ({ ...f, id: ids.get(f.id)!, orgId: org.id, donorId: map(f.donorId)! })));
      if (gifts.length) await tx.insert(s.gifts).values(gifts.map((g) => ({ ...g, id: randomUUID(), orgId: org.id, donorId: map(g.donorId)!, recoveredFailureId: map(g.recoveredFailureId) })));
      if (notes.length) await tx.insert(s.notes).values(notes.map((n) => ({ ...n, id: randomUUID(), failureId: map(n.failureId)! })));
      if (events.length) await tx.insert(s.events).values(events.map((e) => ({ ...e, id: randomUUID(), orgId: org.id, donorId: map(e.donorId) })));
      if (audit.length) await tx.insert(s.audit).values(audit.map((a) => ({ ...a, id: randomUUID(), orgId: org.id, subjectId: map(a.subjectId) })));
      if (memos.length) await tx.insert(s.memos).values(memos.map((m) => ({ ...m, id: randomUUID(), orgId: org.id, donorId: map(m.donorId) })));
      // Done fixes stay done in the copy: their claim keys name the copied rescue.
      if (actions.length)
        await tx.insert(s.paypalActions).values(actions.map((a) => ({ ...a, id: randomUUID(), orgId: org.id, failureId: map(a.failureId), claimKey: a.failureId ? a.claimKey.replace(a.failureId, map(a.failureId)!) : `${a.claimKey}:${org.id}` })));
      return org;
    });
  } catch (e) {
    // Two first requests at once: the other one made the copy.
    const made = await db.query.orgs.findFirst({ where: eq(s.orgs.visitorKey, visitorKey) });
    if (made) return made;
    throw e;
  }
}
