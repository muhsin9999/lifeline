"use client";

import { useState } from "react";
import { m } from "motion/react";
import { ArrowUpIcon, CheckIcon, ChevronDownIcon, LoaderIcon } from "lucide-react";
import { AgentAvatar, type AgentMood } from "@/components/brand/agent-avatar";
import { cn } from "@/lib/utils";

export type TraceStep = { tool: string; label: string; at: string; detail?: string; plan?: string[] };

export type RailMessage =
  | { kind: "text"; text: string; chips?: { label: string; href?: string }[] }
  | { kind: "work"; steps: TraceStep[]; running: boolean };

/**
 * The right-hand rail where Lifeline AI talks: a short brief on the home page, and on a rescue the agent's plan
 * and live tool calls. Main content always comes first, so the rail is fixed-width and quiet.
 */
export function ChatRail({ mood = "idle", status, messages }: { mood?: AgentMood; status?: string; messages: RailMessage[] }) {
  return (
    <aside className="sticky top-0 hidden h-svh w-[22rem] shrink-0 flex-col border-l border-line bg-surface/60 lg:flex">
      <header className="flex items-center gap-3 border-b border-line px-5 py-4">
        <AgentAvatar mood={mood} className="size-10" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Lifeline AI</p>
          <p className="truncate text-xs text-muted-foreground">{status ?? "Your giving recovery assistant"}</p>
        </div>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
        {messages.map((msg, i) =>
          msg.kind === "text" ? <TextMessage key={i} {...msg} /> : <WorkMessage key={i} steps={msg.steps} running={msg.running} />,
        )}
      </div>
      <form className="border-t border-line p-4" onSubmit={(e) => e.preventDefault()}>
        <label className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-soft focus-within:border-input">
          <span className="sr-only">Ask Lifeline</span>
          <input disabled placeholder="Ask Lifeline… (coming with the agent)" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed" />
          <button disabled className="grid size-7 place-items-center rounded-lg bg-ink text-white disabled:opacity-30" aria-label="Send">
            <ArrowUpIcon className="size-4" />
          </button>
        </label>
      </form>
    </aside>
  );
}

function TextMessage({ text, chips }: { text: string; chips?: { label: string; href?: string }[] }) {
  return (
    <m.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2.5">
      <p className="rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-pretty whitespace-pre-line shadow-soft">{text}</p>
      {chips?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) =>
            c.href ? (
              <a key={c.label} href={c.href} className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink hover:border-input">
                {c.label}
              </a>
            ) : (
              <span key={c.label} className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink">
                {c.label}
              </span>
            ),
          )}
        </div>
      ) : null}
    </m.div>
  );
}

const secondsBetween = (a?: string, b?: string) => (a && b ? Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000)) : null);

/** The agent's plan and tool calls. While it works every step shows; when done it folds to "N steps in Xs". */
function WorkMessage({ steps, running }: { steps: TraceStep[]; running: boolean }) {
  const [open, setOpen] = useState(running);
  const plan = steps.find((s) => s.tool === "write_plan")?.plan ?? [];
  const calls = steps.filter((s) => s.tool !== "write_plan");
  const secs = secondsBetween(steps[0]?.at, steps.at(-1)?.at);
  const expanded = running || open;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
      <button type="button" disabled={running} onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm disabled:cursor-default">
        <span className="font-medium">{running ? "Working on this rescue" : `Looked into it · ${calls.length} ${calls.length === 1 ? "step" : "steps"}${secs ? ` in ${secs}s` : ""}`}</span>
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
                {c.detail ? <p className="mt-0.5 pl-5.5 text-xs text-ink-muted">{c.detail}</p> : null}
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
