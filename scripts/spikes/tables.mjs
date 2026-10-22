// Lists the public tables on the dev and live (main) branches. node --env-file=.env.local scripts/spikes/tables.mjs
import "../../src/lib/net.ts";
import postgres from "postgres";
for (const k of ["DATABASE_URL", "DATABASE_URL_PROD"]) {
  const sql = postgres(process.env[k], { max: 1, prepare: false });
  const t = await sql`select table_name from information_schema.tables where table_schema='public'`;
  console.log(k, t.map((r) => r.table_name));
  await sql.end();
}
