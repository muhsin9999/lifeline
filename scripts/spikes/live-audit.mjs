// Prints the LIVE database's AI audit rows (kind, time, detail): node --env-file=.env.local scripts/spikes/live-audit.mjs
import "../../src/lib/net.ts";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL_PROD, { max: 1, prepare: false });
const rows = await sql`select kind, created_at, model, left(output::text, 300) as detail from audit where kind like 'ai.%' order by created_at desc limit 12`;
for (const r of rows) console.log(r.kind, r.created_at.toISOString(), r.model, r.detail);
await sql.end();
