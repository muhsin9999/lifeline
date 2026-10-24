// Counts AI calls on the LIVE database in the last hour: node --env-file=.env.local scripts/spikes/live-ai-usage.mjs
import "../../src/lib/net.ts";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL_PROD, { max: 1, prepare: false });
const rows = await sql`select kind, count(*)::int as n from audit where created_at > now() - interval '1 hour' group by kind order by kind`;
for (const r of rows) console.log(r.kind, r.n);
await sql.end();
