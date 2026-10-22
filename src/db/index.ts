// One Drizzle client for the whole app, on Neon Postgres (pooled connection string in DATABASE_URL).
import "server-only";
import "@/lib/net";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // Neon's pooler runs PgBouncer in transaction mode, which does not support prepared statements.
  return drizzle(postgres(url, { max: 5, prepare: false }), { schema });
}

type Db = ReturnType<typeof create>;
const g = globalThis as unknown as { __lifelineDb?: Db };

// Connect on first use, so importing this module (e.g. during `next build`) never needs the database.
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = (g.__lifelineDb ??= create());
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
export { schema };
