"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActivityIcon, ArrowLeftIcon, BarChart3Icon, HeartPulseIcon, NetworkIcon, UsersIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/rescues", label: "Rescues", icon: HeartPulseIcon },
  { href: "/donors", label: "Donors", icon: UsersIcon },
  { href: "/reports", label: "Reports", icon: BarChart3Icon },
  { href: "/activity", label: "Activity", icon: ActivityIcon },
];

export function Sidebar({ orgName }: { orgName: string }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-svh w-56 shrink-0 flex-col border-r border-line bg-sidebar px-3 py-5 md:flex">
      <Link href="/" aria-label="Lifeline home page" className="rounded-md px-2">
        <Logo />
      </Link>
      <p className="mt-1 px-2 text-xs text-muted-foreground">{orgName}</p>
      <nav className="mt-7 flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink-muted transition-colors hover:bg-sidebar-accent hover:text-ink",
                active && "bg-brand-tint font-medium text-brand-strong hover:bg-brand-tint hover:text-brand-strong",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      {/* Ways out of the app: back to the landing page, and how Lifeline is built. */}
      <div className="mt-auto flex flex-col gap-0.5 border-t border-line pt-3">
        <Link href="/architecture" className="flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-xs text-ink-muted hover:bg-sidebar-accent hover:text-ink">
          <NetworkIcon className="size-3.5" />
          How it&apos;s built
        </Link>
        <Link href="/" className="flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-xs text-ink-muted hover:bg-sidebar-accent hover:text-ink">
          <ArrowLeftIcon className="size-3.5" />
          Lifeline home
        </Link>
      </div>
      <div className="mt-3 flex items-center gap-2 px-2 text-[11px] whitespace-nowrap text-muted-foreground">
        <span className="size-1.5 rounded-full bg-recovered" />
        Connected to PayPal · Sandbox
      </div>
    </aside>
  );
}
