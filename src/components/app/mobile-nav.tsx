"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { NAV } from "./sidebar";

// Phones and small tablets, where the sidebar is hidden: a slim top bar (the logo goes back to the landing page)
// and a tab bar along the bottom with the same four pages.
export function MobileTop({ orgName }: { orgName: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper/95 px-4 backdrop-blur md:hidden">
      <Link href="/" aria-label="Lifeline home page">
        <Logo size="sm" />
      </Link>
      <span className="truncate pl-3 text-xs text-muted-foreground">{orgName}</span>
    </header>
  );
}

export function MobileTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="App" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px] text-ink-muted", active && "font-medium text-brand-strong")}>
            <Icon className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
