import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { currentOrg } from "@/server/queries";

// What Lifeline AI remembers, for the rail's "What I remember" list.
export async function GET() {
  const org = await currentOrg();
  const rows = await db.select({ id: s.memos.id, text: s.memos.text, donor: s.donors.name }).from(s.memos).leftJoin(s.donors, eq(s.donors.id, s.memos.donorId)).where(eq(s.memos.orgId, org.id)).orderBy(desc(s.memos.createdAt));
  return Response.json({ memos: rows }, { headers: { "cache-control": "no-store" } });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "Unknown memo" }, { status: 400 });
  const org = await currentOrg();
  await db.delete(s.memos).where(and(eq(s.memos.id, id), eq(s.memos.orgId, org.id)));
  return Response.json({ ok: true });
}
