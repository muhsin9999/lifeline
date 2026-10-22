"use client";

import { useState } from "react";
import { CheckIcon, ChevronDownIcon, MailIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FIXES, type FixId } from "@/lib/fixes";
import { cn } from "@/lib/utils";

/**
 * The officer's decision: the recommended fix first, the others one click away, what happens next, and the note.
 * Nothing reaches PayPal or the donor until the officer presses the button.
 */
export function RescueActions({ first, amount, fixes, recommended, retryOn, note }: { first: string; amount: string; fixes: FixId[]; recommended: FixId; retryOn: string | null; note: { subject: string; body: string; to: string } | null }) {
  const [chosen, setChosen] = useState<FixId>(recommended);
  const [more, setMore] = useState(false);
  const [preview, setPreview] = useState(true);
  const others = fixes.filter((f) => f !== recommended);
  const shown = more ? [recommended, ...others] : [recommended];
  const sendsNote = chosen === "note";

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        {shown.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setChosen(id)}
            aria-pressed={chosen === id}
            className={cn(
              "flex w-full items-start gap-3 rounded-2xl border bg-surface px-4 py-3 text-left shadow-soft transition-colors",
              chosen === id ? "border-ink" : "border-line hover:border-input",
            )}
          >
            <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", chosen === id ? "border-ink bg-ink text-white" : "border-input")}>
              {chosen === id ? <CheckIcon className="size-3" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-medium">
                {FIXES[id].label}
                {id === recommended ? <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-ink-muted">Suggested</span> : null}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{FIXES[id].does(first, amount)}</span>
            </span>
          </button>
        ))}
        {others.length ? (
          <button type="button" onClick={() => setMore((v) => !v)} className="flex items-center gap-1 px-1 text-xs text-muted-foreground hover:text-ink">
            {more ? "Fewer fixes" : `${others.length} other fixes`}
            <ChevronDownIcon className={cn("size-3.5 transition-transform", more && "rotate-180")} />
          </button>
        ) : null}
      </div>

      {sendsNote && note ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
          <button type="button" onClick={() => setPreview((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
            <MailIcon className="size-4 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm">
              <span className="font-medium">To {first}</span>
              <span className="text-muted-foreground"> · {note.subject}</span>
            </span>
            <ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform", preview && "rotate-180")} />
          </button>
          {preview ? <p className="border-t border-line px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-ink/90">{note.body}</p> : null}
        </div>
      ) : null}

      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-muted-foreground">
        <li>{sendsNote ? "Note goes out when you approve" : "PayPal is updated when you approve"}</li>
        <li aria-hidden>→</li>
        {retryOn ? <li>PayPal retries {retryOn}</li> : null}
        {retryOn ? <li aria-hidden>→</li> : null}
        <li>Lifeline watches for {first}&apos;s next gift</li>
      </ol>

      <div className="flex items-center gap-3">
        <Button size="lg" className="h-10 px-4 text-sm">
          {sendsNote ? `Approve and send to ${first}` : `Approve: ${FIXES[chosen].label.toLowerCase()}`}
        </Button>
        {sendsNote ? <Button variant="ghost" size="lg" className="h-10 text-sm">Edit note</Button> : null}
      </div>
    </section>
  );
}
