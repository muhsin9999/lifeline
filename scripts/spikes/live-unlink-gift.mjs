// One-off (3 Nov 2026): Cora's regular $1 daily gift at ~10:50 UTC was linked as a "recovery" by the pre-fix webhook,
// so the giving pulse showed $4 recovered (the true figure is the $3 capture). Unlinks that one gift, in the REAL
// workspace only, and prints before and after.
// Usage: node --env-file=.env.local --import tsx scripts/spikes/live-unlink-gift.mjs
import "../../src/lib/net.ts";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL_PROD, { max: 1, prepare: false });
const rows = () => sql`select g.paypal_transaction_id tx, g.amount_cents, g.charged_at, g.recovered_failure_id is not null as linked from gifts g join donors d on d.id=g.donor_id join orgs o on o.id=g.org_id where o.copy_of is null and d.paypal_subscription_id='I-4P1HXE6LTF36' and g.charged_at > '2026-11-03T00:00:00Z' order by g.charged_at`;
console.log("before", JSON.stringify(await rows()));
await sql`update gifts g set recovered_failure_id=null from donors d, orgs o where d.id=g.donor_id and o.id=g.org_id and o.copy_of is null and d.paypal_subscription_id='I-4P1HXE6LTF36' and g.amount_cents=100 and g.charged_at between '2026-11-03T10:45:00Z' and '2026-11-03T11:00:00Z'`;
console.log("after ", JSON.stringify(await rows()));
await sql.end();
