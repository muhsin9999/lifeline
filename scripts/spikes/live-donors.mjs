// The real workspace's donors (name, email, PayPal status, owed): node --env-file=.env.local scripts/spikes/live-donors.mjs
import "../../src/lib/net.ts";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL_PROD, { max: 1, prepare: false });
for (const r of await sql`select d.name, d.email, d.status, d.outstanding_cents, d.paypal_subscription_id from donors d join orgs o on o.id=d.org_id where o.copy_of is null`) console.log(JSON.stringify(r));
await sql.end();
