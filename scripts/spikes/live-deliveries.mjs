// Prints the latest webhook deliveries from the LIVE database: node --env-file=.env.local scripts/spikes/live-deliveries.mjs
import "../../src/lib/net.ts";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL_PROD, { max: 1, prepare: false });
const rows = await sql`select received_at, type, verification, outcome, left(coalesce(error,''), 90) as error from webhook_deliveries order by received_at desc limit 5`;
for (const r of rows) console.log(r.received_at.toISOString().slice(11, 19), r.type, r.verification, r.outcome, r.error);
await sql.end();
