"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActivityIcon, BarChart3Icon, HeartPulseIcon, UsersIcon } from "lucide-react";
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
      <Link href="/rescues" aria-label="Lifeline home" className="rounded-md px-2">
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
      <div className="mt-auto flex items-center gap-2 px-2 text-[11px] whitespace-nowrap text-muted-foreground">
        <span className="size-1.5 rounded-full bg-recovered" />
        Connected to PayPal · Sandbox
      </div>
    </aside>
  );
}
