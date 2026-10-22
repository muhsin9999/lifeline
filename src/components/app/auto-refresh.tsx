"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-reads the page every `ms` while `active`, so the agent's steps appear as it takes them. */
export function AutoRefresh({ active, ms = 1200 }: { active: boolean; ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), ms);
    return () => clearInterval(t);
  }, [active, ms, router]);
  return null;
}
