// The LIVE database's open rescues, memos and recent notes: node --env-file=.env.local scripts/spikes/live-state.mjs
import "../../src/lib/net.ts";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL_PROD, { max: 1, prepare: false });
for (const r of await sql`select f.status, d.name, f.failed_at::date d, f.recommended_fix from failures f join donors d on d.id=f.donor_id order by f.failed_at desc limit 8`) console.log("rescue", JSON.stringify(r));
for (const r of await sql`select status, count(*)::int n from failures group by 1`) console.log("count", JSON.stringify(r));
for (const r of await sql`select * from memos order by created_at`) console.log("memo", JSON.stringify(r));
for (const r of await sql`select subject, status, created_at from notes order by created_at desc limit 4`) console.log("note", JSON.stringify(r));
await sql.end();
