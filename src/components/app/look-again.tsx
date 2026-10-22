"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCwIcon } from "lucide-react";
import { lookAgain } from "@/server/actions/rescue";

export function LookAgain({ failureId }: { failureId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await lookAgain(failureId); router.refresh(); })}
      className="inline-flex items-center gap-1.5 px-1 text-xs text-muted-foreground hover:text-ink disabled:opacity-50"
    >
      <RotateCwIcon className="size-3.5" /> Ask Lifeline AI to look again
    </button>
  );
}
