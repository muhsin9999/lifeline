// Deletes ONE memo on the LIVE database by id: node --env-file=.env.local scripts/spikes/live-delete-memo.mjs <memo-id>
import "../../src/lib/net.ts";
import postgres from "postgres";
const id = process.argv[2];
if (!/^[0-9a-f-]{36}$/.test(id ?? "")) throw new Error("pass a memo id");
const sql = postgres(process.env.DATABASE_URL_PROD, { max: 1, prepare: false });
const gone = await sql`delete from memos where id = ${id} returning text`;
console.log("deleted", gone.length, gone.map((r) => r.text));
console.log("memos left", (await sql`select count(*)::int n from memos`)[0].n);
await sql.end();
