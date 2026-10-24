import { cn } from "@/lib/utils";

/** The heartbeat that follows the wordmark. Reused small wherever the brand needs a mark (favicon, rail). */
export function PulseMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 24" fill="none" aria-hidden className={cn("h-5 w-10 text-brand", className)}>
      <path d="M1 13h12l3-5 4 12 5-19 4 15 3-3h15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// The heartbeat always comes first, then the wordmark. `size` scales both together so every placement matches.
export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const text = { sm: "text-base", md: "text-[1.45rem]", lg: "text-[1.6rem]" }[size];
  const mark = { sm: "h-4 w-8", md: "h-6 w-11", lg: "h-7 w-12" }[size];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <PulseMark className={mark} />
      <span className={cn(text, "font-bold tracking-[-0.035em] text-ink")}>Lifeline</span>
    </span>
  );
}
