// The real workspace's plans and which donors are on them: node --env-file=.env.local --import tsx scripts/spikes/live-plans.mjs
import "../../src/lib/net.ts";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL_PROD, { max: 1, prepare: false });
for (const r of await sql`select p.slug, p.name, p.amount_cents, p.interval_unit, p.paypal_plan_id from plans p`) console.log("plan", JSON.stringify(r));
for (const r of await sql`select d.name, d.plan_id is not null as has_plan, p.interval_unit, d.started_at, d.last_payment_at, d.next_billing_at, d.synced_at from donors d join orgs o on o.id=d.org_id left join plans p on p.id=d.plan_id where o.copy_of is null`) console.log("donor", JSON.stringify(r));
await sql.end();
