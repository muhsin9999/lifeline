// Dev database: re-run the rescue agent on a donor's open rescue and print the fix and note (real model call).
import { desc, eq, ilike } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { diagnose } from "@/server/ai/rescue";
const [g] = await db.select().from(s.donors).where(ilike(s.donors.name, `${process.argv[2] ?? "Grace"}%`));
const [f] = await db.select().from(s.failures).where(eq(s.failures.donorId, g.id)).orderBy(desc(s.failures.failedAt)).limit(1);
await diagnose(f.id);
const [after] = await db.select().from(s.failures).where(eq(s.failures.id, f.id));
const [n] = await db.select().from(s.notes).where(eq(s.notes.failureId, f.id)).orderBy(desc(s.notes.createdAt)).limit(1);
console.log("fixes:", JSON.stringify(after.fixes), "· recommended:", after.recommendedFix);
console.log("summary:", (after.diagnosis as { summary?: string })?.summary);
console.log("note:", n?.body);
process.exit(0);
