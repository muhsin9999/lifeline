import "../../src/lib/net.ts";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL_PROD, { max: 1, prepare: false });
for (const r of await sql`select received_at, type, outcome, verification, paypal_event_id, left(coalesce(error,''),120) err from webhook_deliveries where received_at > now() - interval '45 minutes' order by received_at`) console.log("delivery", JSON.stringify(r));
for (const r of await sql`select e.occurred_at, e.type, e.summary, o.copy_of is null as real from events e left join orgs o on o.id=e.org_id where e.received_at > now() - interval '45 minutes' order by e.received_at`) console.log("event", JSON.stringify(r));
await sql.end();
