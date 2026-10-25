// Dev database: the memos Ask Lifeline saved, and Grace's latest diagnosis.
import { desc, eq, ilike } from "drizzle-orm";
import { db, schema as s } from "@/db";
for (const m of await db.select({ text: s.memos.text, donor: s.donors.name }).from(s.memos).leftJoin(s.donors, eq(s.donors.id, s.memos.donorId)).orderBy(desc(s.memos.createdAt)).limit(5)) console.log("memo:", m.donor ?? "(no donor)", "·", m.text);
const [g] = await db.select().from(s.donors).where(ilike(s.donors.name, "Grace%"));
const [f] = await db.select().from(s.failures).where(eq(s.failures.donorId, g.id)).orderBy(desc(s.failures.failedAt)).limit(1);
console.log("status:", f.status);
console.log("diagnosis:", JSON.stringify(f.diagnosis)?.slice(0, 400));
console.log("fixes:", JSON.stringify((f as Record<string, unknown>).fixes), "recommended:", (f as Record<string, unknown>).recommended);
const [n] = await db.select().from(s.notes).where(eq(s.notes.failureId, f.id)).orderBy(desc(s.notes.createdAt)).limit(1);
console.log("note:", n?.body);
process.exit(0);
