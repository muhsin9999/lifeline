// The dashboard's data: Lifeline's real rows (which mirror PayPal), flattened into plain tables for AG Studio.
// Labels are words a fundraising officer uses, not PayPal codes.
import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { FIXES, type FixId } from "@/lib/fixes";
import { causeLabel } from "@/lib/labels";

const STATUS: Record<string, string> = {
  new: "Needs you",
  diagnosing: "Needs you",
  awaiting_approval: "Needs you",
  acting: "Watching",
  watching: "Watching",
  recovered: "Recovered",
  paused: "Paused",
  cancelled: "Cancelled",
  lost: "Lost",
};
const DONOR_STATUS: Record<string, string> = { ACTIVE: "Active", SUSPENDED: "Paused", CANCELLED: "Cancelled", EXPIRED: "Ended", APPROVAL_PENDING: "Signing up" };
const dollars = (cents: number | null | undefined) => (cents ?? 0) / 100;
const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function getStudioData(orgId: string) {
  const [donors, gifts, failures] = await Promise.all([
    db.query.donors.findMany({ where: eq(s.donors.orgId, orgId), orderBy: asc(s.donors.name) }),
    db.query.gifts.findMany({ where: eq(s.gifts.orgId, orgId), with: { donor: true }, orderBy: asc(s.gifts.chargedAt) }),
    db.query.failures.findMany({ where: eq(s.failures.orgId, orgId), with: { donor: true }, orderBy: asc(s.failures.failedAt) }),
  ]);
  const giftCount = new Map<string, number>();
  for (const g of gifts) giftCount.set(g.donorId, (giftCount.get(g.donorId) ?? 0) + 1);

  return {
    gifts: gifts.map((g) => ({
      date: isoDay(g.chargedAt)!,
      donor: g.donor.name,
      amount: dollars(g.amountCents),
      type: g.recoveredFailureId ? "Recovered" : "Regular",
    })),
    failedGifts: failures.map((f) => ({
      date: isoDay(f.failedAt)!,
      donor: f.donor.name,
      amount: dollars(f.amountCents),
      cause: causeLabel(f.reasonCode),
      status: STATUS[f.status] ?? f.status,
      fix: f.chosenFix ? FIXES[f.chosenFix as FixId]?.label ?? f.chosenFix : "None yet",
      recovered: dollars(f.recoveredCents),
      yearAtStake: dollars(f.donor.amountCents * 12),
    })),
    donors: donors.map((d) => ({
      donor: d.name,
      monthlyGift: dollars(d.amountCents),
      status: DONOR_STATUS[d.status] ?? d.status,
      since: isoDay(d.startedAt),
      gifts: giftCount.get(d.id) ?? 0,
      lastGift: isoDay(d.lastPaymentAt),
      failedPayments: d.failedPaymentsCount,
    })),
  };
}
export type StudioData = Awaited<ReturnType<typeof getStudioData>>;
