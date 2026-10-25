"use client";

import { useTransition } from "react";
import { PlayIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resumeGiftAction } from "@/server/actions/rescue";

/** Resumes a paused monthly gift on PayPal, after this click only. */
export function ResumeGift({ failureId, first }: { failureId: string; first: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      className="h-9 px-3 text-sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await resumeGiftAction(failureId);
          if (r.ok) toast.success(r.message);
          else if (r.pending) toast.message(r.message);
          else toast.error(r.message);
        })
      }
    >
      <PlayIcon aria-hidden />
      {pending ? "Resuming…" : `Resume ${first}'s gift`}
    </Button>
  );
}
