import { createHash } from "node:crypto";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { ask } from "@/server/ai/ask";
import { fakeAiEnabled, modelFor, openai } from "@/server/ai/client";
import { fakeAskClient } from "@/server/ai/fake-client";
import { currentOrg } from "@/server/queries";
import { readUpload, type Upload } from "@/server/uploads";

// "Ask Lifeline": streams the agent's steps as newline-delimited JSON, then its answer. Takes JSON, or a form with an
// optional file (a donor's email, a screenshot, a PDF) that the agent reads.
const Body = z.object({
  question: z.string().trim().min(1).max(400),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(1200) })).max(12).default([]),
});

/** A public demo: cap model use per hour across all visitors. */
const HOURLY_CAP = Number(process.env.ASK_HOURLY_CAP || 60);

export async function POST(request: Request) {
  let raw: unknown = null;
  let file: Upload | null = null;
  if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const f = form?.get("file");
    if (f instanceof File && f.size > 0) {
      const up = await readUpload(f);
      if ("error" in up) return Response.json({ error: up.error }, { status: 400 });
      file = up;
    }
    let history: unknown = [];
    try {
      history = JSON.parse(String(form?.get("history") ?? "[]"));
    } catch {}
    raw = { question: String(form?.get("question") ?? "").trim() || (file ? `I've attached ${file.name}.` : ""), history };
  } else raw = await request.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Ask a question of up to 400 characters." }, { status: 400 });
  const org = await currentOrg();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.audit).where(and(eq(s.audit.orgId, org.id), eq(s.audit.kind, "ai.ask"), gte(s.audit.createdAt, new Date(Date.now() - 3_600_000))));
  if (n >= HOURLY_CAP) return Response.json({ error: "Lifeline AI has answered a lot of questions this hour. Try again in a little while." }, { status: 429 });

  const { question, history } = parsed.data;
  const fake = fakeAiEnabled();
  const model = fake ? "fake-local" : modelFor("rescue");
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(o)}\n`));
      try {
        const run = await ask(org.id, question, history, { file, client: fake ? fakeAskClient() : openai(), model, onStep: (step) => send({ type: "step", step: { ...step, at: new Date().toISOString() } }) });
        // Keep only links to rescues that really exist for this organisation.
        const ids = run.output.links.map((l) => l.rescue_id).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
        const real = ids.length ? await db.query.failures.findMany({ where: and(eq(s.failures.orgId, org.id), inArray(s.failures.id, ids)), columns: { id: true } }) : [];
        const ok = new Set(real.map((r) => r.id));
        const links = run.output.links.filter((l) => ok.has(l.rescue_id)).slice(0, 3).map((l) => ({ label: l.label, href: `/rescues/${l.rescue_id}` }));
        send({ type: "answer", answer: run.output.answer, links, ms: run.ms });
        await db.insert(s.audit).values({ orgId: org.id, kind: "ai.ask", model: run.model, inputHash: createHash("sha256").update(question).digest("hex").slice(0, 16), output: { question, answer: run.output.answer, tools: run.tools, ms: run.ms, usage: run.usage } });
      } catch (e) {
        console.error("ask failed", e);
        send({ type: "error", message: "Lifeline AI couldn't answer that just now. Try again in a moment." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
