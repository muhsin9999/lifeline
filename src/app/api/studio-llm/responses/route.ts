import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { modelFor } from "@/server/ai/client";
import { currentOrg } from "@/server/queries";

// The dashboard's AG Studio agents call OpenAI's Responses API through here (their adapter posts to
// `/api/studio-llm/responses`), so the key stays on the server. Lifeline picks the model and effort, caps the
// output, and caps turns per hour because the demo is public.
const HOURLY_TURN_CAP = Number(process.env.STUDIO_HOURLY_TURN_CAP || 300);

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ error: { message: "Lifeline AI isn't connected on this deployment." } }, { status: 503 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !Array.isArray(body.input)) return Response.json({ error: { message: "Bad request" } }, { status: 400 });

  const org = await currentOrg();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.audit).where(and(eq(s.audit.orgId, org.id), eq(s.audit.kind, "ai.studio.turn"), gte(s.audit.createdAt, new Date(Date.now() - 3_600_000))));
  if (n >= HOURLY_TURN_CAP) return Response.json({ error: { message: "The dashboard assistant has been busy this hour. Try again in a little while." } }, { status: 429 });
  await db.insert(s.audit).values({ orgId: org.id, kind: "ai.studio.turn", model: modelFor("studio") });

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ ...body, model: modelFor("studio"), reasoning: { effort: "low" }, max_output_tokens: 4000, stream: true }),
    signal: request.signal,
  }).catch(() => null);
  if (!upstream) return Response.json({ error: { message: "Couldn't reach the AI service." } }, { status: 502 });
  if (!upstream.ok || !upstream.body) {
    const err = (await upstream.json().catch(() => ({}))) as { error?: { message?: string } };
    console.error("studio-llm upstream", upstream.status, err.error?.message);
    return Response.json({ error: { message: upstream.status === 429 ? "The AI service is busy. Try again shortly." : "The AI service refused this request." } }, { status: upstream.status >= 500 ? 502 : upstream.status });
  }
  return new Response(upstream.body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}
