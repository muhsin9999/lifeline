// The real workspace's recent PayPal-write claims: node --env-file=.env.local scripts/spikes/live-claims.mjs
import "../../src/lib/net.ts";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL_PROD, { max: 1, prepare: false });
for (const r of await sql`select a.claim_key, a.kind, a.status, a.result, a.error, a.created_at from paypal_actions a join orgs o on o.id=a.org_id where o.copy_of is null order by a.created_at desc limit 5`) console.log(JSON.stringify(r));
for (const r of await sql`select type, outcome, verification, received_at from webhook_deliveries order by received_at desc limit 5`) console.log("webhook", JSON.stringify(r));
await sql.end();
