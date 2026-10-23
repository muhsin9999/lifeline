// Prints the LIVE database's rescues and gifts: node --env-file=.env.local scripts/spikes/live-rescues.mjs
import "../../src/lib/net.ts";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL_PROD, { max: 1, prepare: false });
const f = await sql`select f.id, d.name, f.status, f.amount_cents, f.reason_code, f.failed_at, f.next_retry_at, f.model, left(coalesce(f.error,''),80) as error, f.fixes, f.recommended_fix, jsonb_array_length(f.trace) as steps, f.diagnosis->>'summary' as summary from failures f join donors d on d.id=f.donor_id order by f.failed_at desc`;
for (const r of f) console.log(JSON.stringify(r));
const g = await sql`select d.name, g.amount_cents, g.charged_at from gifts g join donors d on d.id=g.donor_id order by g.charged_at`;
for (const r of g) console.log("gift", r.name, r.amount_cents, r.charged_at.toISOString());
const n = await sql`select subject, left(body,120) as body, status from notes`;
for (const r of n) console.log("note", JSON.stringify(r));
await sql.end();
