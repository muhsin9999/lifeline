import { cn } from "@/lib/utils";

/** The heartbeat that follows the wordmark. Reused small wherever the brand needs a mark (favicon, rail). */
export function PulseMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 24" fill="none" aria-hidden className={cn("h-5 w-10 text-brand", className)}>
      <path d="M1 13h12l3-5 4 12 5-19 4 15 3-3h15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="text-[1.35rem] font-bold tracking-[-0.035em] text-ink">Lifeline</span>
      <PulseMark />
    </span>
  );
}
