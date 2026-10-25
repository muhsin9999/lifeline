"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { m } from "motion/react";
import { ArrowUpIcon, BrainIcon, CheckIcon, ChevronDownIcon, FileTextIcon, LoaderIcon, PaperclipIcon, XIcon } from "lucide-react";
import { AgentAvatar, type AgentMood } from "@/components/brand/agent-avatar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { plainWords } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type TraceStep = { tool: string; label: string; at: string; detail?: string; plan?: string[] };
type Chip = { label: string; href?: string; ask?: string };

export type RailMessage =
  | { kind: "text"; text: string; chips?: Chip[] }
  | { kind: "user"; text: string; file?: string }
  | { kind: "work"; steps: TraceStep[]; running: boolean; about?: "rescue" | "question" };

/**
 * The right-hand rail where Lifeline AI talks: a short brief on the home page, on a rescue the agent's plan and
 * live tool calls, and anywhere the officer's own questions ("Ask Lifeline"), answered from real data with the
 * steps shown. Main content always comes first, so the rail is fixed-width and quiet.
 */
const KEPT = "lifeline-ask";
type Memo = { id: string; text: string; donor: string | null };

export function ChatRail({ mood = "idle", status, messages, suggestions = [] }: { mood?: AgentMood; status?: string; messages: RailMessage[]; suggestions?: string[] }) {
  // The conversation stays with this browser tab across pages, so "what did we just talk about?" works.
  const [chat, setChat] = useState<RailMessage[]>([]);
  const restored = useRef(false);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [memos, setMemos] = useState<Memo[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
    if (!restored.current) return;
    try {
      sessionStorage.setItem(KEPT, JSON.stringify(chat.filter((x) => x.kind !== "work").slice(-30)));
    } catch {}
  }, [chat]);
  // After mount (never during render, so server and browser agree): bring back this tab's conversation.
  useEffect(() => {
    let kept: RailMessage[] = [];
    try {
      kept = (JSON.parse(sessionStorage.getItem(KEPT) ?? "[]") as RailMessage[]).filter((x) => x.kind !== "work");
    } catch {}
    restored.current = true;
    if (kept.length) queueMicrotask(() => setChat(kept));
  }, []);
  const loadMemos = () =>
    fetch("/api/memos", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { memos?: Memo[] }) => setMemos(d.memos ?? []))
      .catch(() => {});
  useEffect(() => {
    loadMemos();
  }, []);

  async function askLifeline(question: string) {
    const q = question.trim() || (file ? `I've attached ${file.name}.` : "");
    if (!q || busy) return;
    const attached = file;
    setBusy(true);
    setDraft("");
    setFile(null);
    const history = chat.flatMap((x): { role: "user" | "assistant"; text: string }[] => (x.kind === "user" ? [{ role: "user" as const, text: x.text }] : x.kind === "text" ? [{ role: "assistant" as const, text: x.text }] : []));
    const work: Extract<RailMessage, { kind: "work" }> = { kind: "work", steps: [], running: true, about: "question" };
    setChat((c) => [...c, { kind: "user", text: q, file: attached?.name }, work]);
    const update = (fn: (w: typeof work) => typeof work) => setChat((c) => c.map((x) => (x.kind === "work" && x.running ? fn(x as typeof work) : x)));
    try {
      const form = new FormData();
      form.set("question", q);
      form.set("history", JSON.stringify(history));
      if (attached) form.set("file", attached);
      const res = await fetch("/api/ask", { method: "POST", body: form });
      if (!res.ok || !res.body) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error ?? "Lifeline AI couldn't answer that just now.");
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const ev = JSON.parse(line) as { type: "step"; step: TraceStep } | { type: "answer"; answer: string; links: { label: string; href: string }[] } | { type: "error"; message: string };
          if (ev.type === "step") update((w) => ({ ...w, steps: [...w.steps, ev.step] }));
          else if (ev.type === "answer") {
            update((w) => ({ ...w, running: false }));
            setChat((c) => [...c, { kind: "text", text: ev.answer, chips: ev.links }]);
          } else throw new Error(ev.message);
        }
      }
    } catch (e) {
      update((w) => ({ ...w, running: false }));
      setChat((c) => [...c, { kind: "text", text: e instanceof Error ? e.message : "Something went wrong." }]);
    } finally {
      setBusy(false);
      loadMemos();
    }
  }

  const [open, setOpen] = useState(false);
  const all = [...messages, ...chat];
  const showSuggestions = !chat.length && suggestions.length > 0;
  const body = (
    <>
      <header className="flex items-center gap-3 px-5 pt-5 pb-3">
        <AgentAvatar glossy mood={busy ? "working" : mood} className="size-12" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Lifeline AI</p>
          <p className="truncate text-xs text-muted-foreground">{busy ? "Looking into your question…" : (status ?? "Your giving recovery assistant")}</p>
        </div>
      </header>
      {memos.length > 0 && <Remembered memos={memos} onForget={(id) => fetch(`/api/memos?id=${id}`, { method: "DELETE" }).then(loadMemos)} />}
      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
        {all.map((msg, i) =>
          msg.kind === "text" ? (
            <TextMessage key={i} {...msg} onAsk={askLifeline} />
          ) : msg.kind === "user" ? (
            <m.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="ml-8 flex flex-col items-end gap-1.5">
              <p className="rounded-2xl rounded-tr-md bg-ink px-4 py-2.5 text-sm text-white">{msg.text}</p>
              {msg.file && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs">
                  <FileTextIcon className="size-3.5 text-muted-foreground" />
                  {msg.file}
                </span>
              )}
            </m.div>
          ) : (
            <WorkMessage key={i} steps={msg.steps} running={msg.running} about={msg.about ?? "rescue"} />
          ),
        )}
        {showSuggestions ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {suggestions.map((q) => (
              <button key={q} type="button" onClick={() => askLifeline(q)} className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink hover:border-input">
                {q}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <form
        className="p-4"
        onSubmit={(e) => {
          e.preventDefault();
          askLifeline(draft);
        }}
      >
        {file && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs">
            <FileTextIcon className="size-3.5 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <button type="button" onClick={() => setFile(null)} aria-label="Remove the file" className="text-muted-foreground hover:text-ink">
              <XIcon className="size-3.5" />
            </button>
          </div>
        )}
        <label className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-soft focus-within:border-input">
          <span className="sr-only">Ask Lifeline</span>
          <span className="relative grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Attach a file">
            <PaperclipIcon className="size-4" />
            <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp,text/csv,text/plain" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Attach a file" />
          </span>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={400} disabled={busy} placeholder="Ask Lifeline…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60" />
          <button disabled={busy || (!draft.trim() && !file)} className="grid size-7 place-items-center rounded-lg bg-ink text-white disabled:opacity-30" aria-label="Send">
            <ArrowUpIcon className="size-4" />
          </button>
        </label>
      </form>
    </>
  );
  return (
    <>
      <aside className="sticky top-0 hidden h-svh w-[22rem] shrink-0 flex-col border-l border-line bg-paper lg:flex">{body}</aside>
      {/* Below desktop width the rail folds into a button that opens the same conversation in a panel. */}
      <button type="button" onClick={() => setOpen(true)} aria-label="Ask Lifeline AI" className="fixed right-4 bottom-20 z-30 flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pr-4 pl-1.5 text-sm font-medium shadow-[0_8px_24px_-8px_rgb(26_20_20/0.3)] md:bottom-6 lg:hidden">
        <AgentAvatar glossy mood={busy ? "working" : mood} className="size-9" label="" />
        Ask Lifeline
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 bg-paper p-0 sm:max-w-md">
          <SheetTitle className="sr-only">Lifeline AI</SheetTitle>
          <div className="flex h-full flex-col">{body}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}


function TextMessage({ text, chips, onAsk }: { text: string; chips?: Chip[]; onAsk: (q: string) => void }) {
  return (
    <m.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2.5">
      <p className="rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-pretty whitespace-pre-line shadow-soft">{text}</p>
      {chips?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) =>
            c.href ? (
              <Link key={c.label} href={c.href} className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink hover:border-input">
                {c.label}
              </Link>
            ) : (
              <button key={c.label} type="button" onClick={() => onAsk(c.ask ?? c.label)} className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink hover:border-input">
                {c.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </m.div>
  );
}

const secondsBetween = (a?: string, b?: string) => (a && b ? Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000)) : null);

/** The agent's plan and tool calls. While it works every step shows; when done it folds to "N steps in Xs". */
function WorkMessage({ steps, running, about }: { steps: TraceStep[]; running: boolean; about: "rescue" | "question" }) {
  const [open, setOpen] = useState(running);
  const plan = steps.find((s) => s.tool === "write_plan")?.plan ?? [];
  const calls = steps.filter((s) => s.tool !== "write_plan");
  const secs = secondsBetween(steps[0]?.at, steps.at(-1)?.at);
  const expanded = running || open;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
      <button type="button" disabled={running} onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm disabled:cursor-default">
        <span className="font-medium">{running ? (about === "rescue" ? "Working on this rescue" : "Looking into it") : `${about === "rescue" ? "Looked into it" : "Checked"} · ${calls.length} ${calls.length === 1 ? "step" : "steps"}${secs ? ` in ${secs}s` : ""}`}</span>
        {running ? <LoaderIcon className="size-4 animate-spin text-muted-foreground" /> : <ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />}
      </button>
      {expanded ? (
        <div className="space-y-4 border-t border-line px-4 py-4">
          {plan.length ? (
            <ol className="space-y-1.5">
              {plan.map((p, i) => (
                <li key={i} className="flex gap-2.5 text-sm">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[11px] tabular-nums text-ink-muted">{i + 1}</span>
                  <span className="text-pretty">{p}</span>
                </li>
              ))}
            </ol>
          ) : null}
          <ul className="space-y-1.5">
            {calls.map((c, i) => (
              <m.li key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="rounded-lg bg-muted/60 px-3 py-2">
                <div className="flex items-center gap-2">
                  <CheckIcon className="size-3.5 text-recovered" />
                  <span className="font-mono text-xs">{c.tool}</span>
                </div>
                {c.detail ? <p className="mt-0.5 pl-5.5 text-xs text-ink-muted">{plainWords(c.detail)}</p> : null}
              </m.li>
            ))}
            {running ? (
              <li className="flex items-center gap-2 px-3 py-1.5 text-xs">
                <LoaderIcon className="size-3.5 animate-spin text-ink-muted" />
                <span className="shimmer-text">{calls.length ? "Thinking about the right fix…" : "Planning…"}</span>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Remembered({ memos, onForget }: { memos: Memo[]; onForget: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-y border-line px-5 py-2">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 text-xs text-muted-foreground hover:text-ink">
        <BrainIcon className="size-3.5" />
        What Lifeline remembers ({memos.length})
        <ChevronDownIcon className={cn("ml-auto size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
          {memos.map((n) => (
            <li key={n.id} className="flex items-start gap-2 rounded-lg bg-surface px-3 py-1.5 text-xs">
              <span className="min-w-0 flex-1">
                {n.text}
                <span className="block text-muted-foreground">about {n.donor ?? "the food bank"}</span>
              </span>
              <button type="button" onClick={() => onForget(n.id)} aria-label={`Forget: ${n.text}`} className="text-muted-foreground hover:text-brand">
                <XIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
