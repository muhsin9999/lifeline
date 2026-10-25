// A donor's status in Lifeline and in PayPal: npx tsx ... q-donor-sub.ts "Cora"
import { ilike } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { paypalSdk } from "@/server/paypal/sdk";
for (const d of await db.select().from(s.donors).where(ilike(s.donors.name, `${process.argv[2] ?? "Cora"}%`))) {
  const sub = d.paypalSubscriptionId ? ((await paypalSdk().subscriptions.getSubscription({ id: d.paypalSubscriptionId })) as { status?: string; billingInfo?: { outstandingBalance?: { value?: string }; failedPaymentsCount?: number } }) : null;
  console.log(d.name, "· lifeline:", d.status, "· paypal:", sub?.status, "· owed:", sub?.billingInfo?.outstandingBalance?.value, "· failed:", sub?.billingInfo?.failedPaymentsCount);
}
process.exit(0);
