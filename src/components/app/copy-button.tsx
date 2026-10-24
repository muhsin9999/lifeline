"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** Copies a value (a PayPal ID) and confirms it in place, so it can be pasted into PayPal's own search. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("Couldn't copy. Select the ID and copy it instead.");
        }
      }}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-xs text-ink-muted hover:text-ink"
      aria-label={`Copy ${label}`}
    >
      {done ? <CheckIcon className="size-3.5 text-recovered" /> : <CopyIcon className="size-3.5" />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}
