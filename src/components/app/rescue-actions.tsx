"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, ChevronDownIcon, MailIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FIXES, type FixId } from "@/lib/fixes";
import { cn } from "@/lib/utils";
import { approveFix } from "@/server/actions/rescue";

/**
 * The officer's decision: the recommended fix first, the others one click away, what happens next, and the note.
 * Nothing reaches PayPal or the donor until the officer presses the button.
 */
export function RescueActions({ failureId, first, amount, amountCents, fixes, recommended, retryOn, note, practice = false }: { failureId: string; first: string; amount: string; amountCents: number; fixes: FixId[]; recommended: FixId; retryOn: string | null; note: { subject: string; body: string; to: string } | null; practice?: boolean }) {
  const router = useRouter();
  const [chosen, setChosen] = useState<FixId>(recommended);
  const [more, setMore] = useState(false);
  const [preview, setPreview] = useState(true);
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(note?.subject ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [lowerTo, setLowerTo] = useState(Math.max(1, Math.floor(amountCents / 200)));
  const [pending, start] = useTransition();
  const others = fixes.filter((f) => f !== recommended);
  const shown = more ? [recommended, ...others] : [recommended];
  const sendsNote = chosen === "note";
  const noteMissing = sendsNote && (!subject.trim() ? "Add a subject" : !body.trim() ? "Write the note" : null);

  const approve = () =>
    start(async () => {
      const r = await approveFix({ failureId, fix: chosen, ...(chosen === "lower" && { newAmountCents: lowerTo * 100 }), ...(chosen === "note" && { note: { subject, body } }) });
      if (r.ok) toast.success(r.message);
      else if (r.pending) toast.message(r.message);
      else toast.error(r.message);
      router.refresh();
    });

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        {shown.map((id) => (
          <div key={id} className={cn("rounded-2xl border bg-surface shadow-soft transition-colors", chosen === id ? "border-ink" : "border-line hover:border-input")}>
            <button type="button" onClick={() => setChosen(id)} aria-pressed={chosen === id} className="flex w-full items-start gap-3 px-4 py-3 text-left">
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
            {id === "lower" && chosen === "lower" ? (
              <label className="flex items-center gap-2 border-t border-line px-4 py-2.5 pl-11 text-sm">
                New monthly gift $
                <input type="number" min={1} max={Math.floor(amountCents / 100) - 1} value={lowerTo} onChange={(e) => setLowerTo(Number(e.target.value))} className="w-20 rounded-md border border-input bg-surface px-2 py-1 tabular-nums" />
              </label>
            ) : null}
          </div>
        ))}
        {others.length ? (
          <button type="button" onClick={() => setMore((v) => !v)} className="flex items-center gap-1 px-1 text-xs text-muted-foreground hover:text-ink">
            {more ? "Fewer fixes" : `${others.length} other ${others.length === 1 ? "fix" : "fixes"}`}
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
              <span className="text-muted-foreground"> · {subject}</span>
            </span>
            <ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform", preview && "rotate-180")} />
          </button>
          {preview && !editing ? <p className="border-t border-line px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-ink/90">{body}</p> : null}
          {editing ? (
            <div className="space-y-2 border-t border-line px-4 py-3">
              <input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" maxLength={120} aria-invalid={!subject.trim() || undefined} className="w-full rounded-md border border-input bg-surface px-2.5 py-1.5 text-sm aria-[invalid=true]:border-red-400" />
              <textarea value={body} onChange={(e) => setBody(e.target.value)} aria-label="Note" rows={7} maxLength={2000} aria-invalid={!body.trim() || undefined} className="w-full resize-y rounded-md border border-input bg-surface px-2.5 py-2 text-sm leading-relaxed aria-[invalid=true]:border-red-400" />
            </div>
          ) : null}
        </div>
      ) : null}

      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-muted-foreground">
        <li>{sendsNote ? "Note goes out when you approve" : practice ? "Practice copy: you’ll see the exact PayPal call, not sent" : "PayPal is updated when you approve"}</li>
        <li aria-hidden>→</li>
        {retryOn && chosen !== "retry" ? <li>PayPal retries {retryOn}</li> : null}
        {retryOn && chosen !== "retry" ? <li aria-hidden>→</li> : null}
        <li>Lifeline watches for {first}&apos;s next gift</li>
      </ol>

      <div className="flex items-center gap-3">
        <Button size="lg" className="h-10 px-4 text-sm" disabled={pending || !!noteMissing} onClick={approve}>
          {pending ? "Working…" : sendsNote ? `Approve and send to ${first}` : `Approve: ${FIXES[chosen].label.toLowerCase()}`}
        </Button>
        {sendsNote ? (
          <Button variant="ghost" size="lg" className="h-10 text-sm" onClick={() => { setEditing((v) => !v); setPreview(true); }}>
            {editing ? "Done editing" : "Edit note"}
          </Button>
        ) : null}
        {noteMissing ? <p role="status" className="text-sm text-muted-foreground">{noteMissing} before sending.</p> : null}
      </div>
    </section>
  );
}
