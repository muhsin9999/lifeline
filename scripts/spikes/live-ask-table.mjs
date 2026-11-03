// Read-only: does the live database have the ask_messages table, and how many rows.
import "../../src/lib/net.ts";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL_PROD, { max: 1, prepare: false });
const [t] = await sql`select to_regclass('public.ask_messages') as t`;
console.log("table:", t.t, t.t ? (await sql`select count(*)::int c from ask_messages`)[0].c + " rows" : "");
await sql.end();
