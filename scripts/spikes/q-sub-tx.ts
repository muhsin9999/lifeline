// A subscription's recent transactions from PayPal (read-only): npx tsx --conditions=react-server --env-file=.env.local scripts/spikes/q-sub-tx.ts <subscriptionId>
import { paypalSdk } from "@/server/paypal/sdk";
const id = process.argv[2];
const end = new Date().toISOString();
const start = new Date(Date.now() - 3 * 86_400_000).toISOString();
const r = await paypalSdk().subscriptions.listSubscriptionTransactions({ id, startTime: start, endTime: end });
for (const t of (r as { transactions?: { id: string; status: string; time: string; amountWithBreakdown?: { grossAmount?: { value: string } } }[] }).transactions ?? []) console.log(t.time, t.status, t.id, t.amountWithBreakdown?.grossAmount?.value);
process.exit(0);
