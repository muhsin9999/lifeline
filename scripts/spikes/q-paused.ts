// Paused rescues and their donors' subscription status as PayPal sees it now.
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { paypalSdk } from "@/server/paypal/sdk";
const rows = await db.query.failures.findMany({ where: eq(s.failures.status, process.argv[2] ?? "paused"), with: { donor: true } });
console.log("db host:", new URL(process.env.DATABASE_URL!).host.split(".")[0], "· paused rescues:", rows.length);
for (const f of rows) {
  const sub = f.donor.paypalSubscriptionId ? await paypalSdk().subscriptions.getSubscription({ id: f.donor.paypalSubscriptionId }) : null;
  console.log(f.id, f.donor.name, "lifeline:", f.donor.status, "paypal:", (sub as { status?: string } | null)?.status ?? "-");
}
process.exit(0);
