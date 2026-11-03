// One-off (3 Nov 2026): Cora's $3 capture at 10:35:27 UTC paid her three failed $1 gifts (23, 24, 25 Oct). Before the
// webhook fix, the newest rescue counted the whole $3 and the 23 Oct one stayed open. Sets all three to recovered at
// $1 each, in the REAL workspace only. Prints before and after.
// Usage: node --env-file=.env.local --import tsx scripts/spikes/live-fix-cora-recovery.mjs
import "../../src/lib/net.ts";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL_PROD, { max: 1, prepare: false });
const rows = () => sql`select f.failed_at::date d, f.status, f.amount_cents, f.recovered_cents from failures f join donors d on d.id=f.donor_id join orgs o on o.id=f.org_id where o.copy_of is null and d.paypal_subscription_id='I-4P1HXE6LTF36' order by f.failed_at`;
console.log("before", JSON.stringify(await rows()));
await sql`update failures f set status='recovered', recovered_cents=f.amount_cents, resolved_at=coalesce(f.resolved_at, '2026-11-03T10:35:27Z') from donors d, orgs o where d.id=f.donor_id and o.id=f.org_id and o.copy_of is null and d.paypal_subscription_id='I-4P1HXE6LTF36' and f.failed_at < '2026-11-01'`;
console.log("after ", JSON.stringify(await rows()));
await sql.end();
