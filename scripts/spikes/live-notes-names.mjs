// Read-only: how many saved notes and audit rows in the real workspace still mention the old officer name.
import "../../src/lib/net.ts";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL_PROD, { max: 1, prepare: false });
const [n] = await sql`select count(*)::int c from notes n join failures f on f.id=n.failure_id join orgs o on o.id=f.org_id where o.copy_of is null and n.body ilike '%tunde%'`;
const [a] = await sql`select count(*)::int c from audit a join orgs o on o.id=a.org_id where o.copy_of is null and a.output::text ilike '%tunde%'`;
const [p] = await sql`select count(*)::int c from paypal_actions x join orgs o on o.id=x.org_id where o.copy_of is null and x::text ilike '%tunde%'`;
console.log({ notes: n.c, audit: a.c, paypalActions: p.c });
await sql.end();
