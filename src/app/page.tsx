import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight, CalendarX, Pause, RotateCw, XCircle } from "lucide-react";
import { AgentAvatar } from "@/components/brand/agent-avatar";
import { Logo } from "@/components/brand/logo";
import { CountUp } from "@/components/landing/count-up";
import { FlowLine } from "@/components/landing/flow-line";
import { HeroAgent } from "@/components/landing/hero-agent";
import { HeroStage } from "@/components/landing/hero-stage";
import { RescueStory } from "@/components/landing/rescue-story";
import { FIXES } from "@/lib/fixes";

export const metadata: Metadata = { title: { absolute: "Lifeline: failed gifts, brought back" } };

// Every figure here is quoted from its source, linked beside it.
const NUMBERS = [
  { value: "27%", label: "of nonprofits' online revenue came from monthly giving in 2025", source: "M+R Benchmarks 2026", href: "https://mrbenchmarks.com/fundraising/" },
  { value: "1 in 10", label: "new monthly donors stop giving within two months", source: "M+R Benchmarks 2026", href: "https://mrbenchmarks.com/fundraising/" },
  { value: "$129B", label: "projected loss to subscription businesses from failed payments in 2025", source: "Recurly, Jan 2024", href: "https://recurly.com/press/failed-payments-could-cost-subscription-companies-more-than-102-billion-in-2025-uk/" },
];

// The five changes Lifeline can make on a donor's PayPal subscription, each with the PayPal call behind it.
const PAYPAL_FIXES = [
  { id: "retry", label: "Retry the charge", icon: RotateCw },
  { id: "pause", label: "Pause", icon: Pause },
  { id: "lower", label: "Lower the gift", icon: ArrowDown },
  { id: "forgive", label: "Forgive a month", icon: CalendarX },
  { id: "cancel", label: "Cancel", icon: XCircle },
] as const;

export default function Landing() {
  return (
    <div className="min-h-svh overflow-x-clip bg-paper text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
        <Link href="/" aria-label="Lifeline home">
          <Logo size="lg" />
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-4">
          <a href="#how" className="hidden rounded-md px-2 py-1.5 text-ink-muted hover:text-ink sm:inline">
            How it works
          </a>
          <Link href="/rescues" className="rounded-md px-2 py-1.5 font-medium text-ink hover:text-brand">
            Open the app
          </Link>
        </nav>
      </header>

      <div className="relative">
        <FlowLine from="hero" to="story" />

        <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-8 lg:pt-14">
          <h1 className="text-[clamp(2.6rem,6.4vw,5.5rem)] leading-[0.98] font-bold tracking-[-0.045em] text-balance">Failed gifts, brought back.</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-muted sm:text-xl">An AI agent that rescues failed monthly PayPal gifts for a small food bank. You approve every fix.</p>
          <Link href="/rescues" className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-6 font-semibold text-white shadow-[0_8px_24px_-8px_var(--brand)] transition-colors hover:bg-brand-strong">
            See it live <ArrowRight className="size-4" />
          </Link>
        </section>

        <div className="mt-6 lg:-mt-6">
          <HeroStage />
          <div className="flex justify-center px-4 pb-6 lg:hidden">
            <HeroAgent />
          </div>
        </div>

        <section id="how" className="scroll-mt-8 pt-16 pb-24 lg:pt-10">
          <RescueStory />
        </section>
      </div>

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-8" aria-labelledby="why">
        <h2 id="why" className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
          Why it matters
        </h2>
        <div className="mt-10 grid gap-10 sm:grid-cols-3">
          {NUMBERS.map((n) => (
            <div key={n.value}>
              <CountUp value={n.value} className="text-5xl font-bold tracking-[-0.04em] tabular-nums sm:text-6xl" />
              <p className="mt-3 max-w-64 text-ink-muted">{n.label}</p>
              <a href={n.href} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-ink-muted underline underline-offset-4 hover:text-ink">
                Source: {n.source}
              </a>
            </div>
          ))}
        </div>
        <p className="mt-10 max-w-2xl text-sm leading-relaxed text-ink-muted">
          A failed payment usually isn&apos;t a donor saying goodbye. It&apos;s a card that expired or a balance that ran short, and the donor may never find out. Lifeline catches it the moment PayPal does.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-8" aria-labelledby="can-do">
        <h2 id="can-do" className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
          What Lifeline can do in PayPal
        </h2>
        <p className="mt-3 max-w-xl text-ink-muted">Real changes to the donor&apos;s PayPal subscription, made only after you approve. Or simply a kind note asking them to update their payment.</p>
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {PAYPAL_FIXES.map(({ id, label, icon: Icon }) => (
            <li key={id} className="flex flex-col items-center rounded-2xl border border-line bg-surface px-4 py-6 text-center shadow-soft">
              <Icon className="size-7 text-ink" strokeWidth={1.6} />
              <p className="mt-4 font-semibold">{label}</p>
              <p className="mt-3 rounded-md bg-paper px-2 py-1 font-mono text-[11px] text-ink-muted">{FIXES[id].call}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="relative mx-4 mb-20 overflow-hidden rounded-3xl bg-ink px-6 py-14 text-paper sm:mx-8 sm:px-12 xl:mx-auto xl:max-w-6xl">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden className="pointer-events-none absolute top-1/2 right-0 left-1/2 hidden h-24 -translate-y-1/2 opacity-25 md:block">
          <path d="M0,60 L180,60 l8,-10 l8,40 l10,-70 l10,50 l8,-10 L520,60 l8,-10 l8,40 l10,-70 l10,50 l8,-10 L760,60 l8,-10 l8,40 l10,-70 l10,50 l8,-10 L1200,60" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="relative flex flex-col items-start justify-between gap-10 md:flex-row md:items-center">
          <div>
            <h2 className="text-[clamp(2.4rem,5vw,4rem)] leading-none font-bold tracking-[-0.045em]">See a real rescue</h2>
            <p className="mt-4 max-w-md text-paper/70">Real PayPal sandbox subscriptions, real webhooks, a real AI diagnosis and a real email to the donor.</p>
            <Link href="/rescues" className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand-strong">
              See it live <ArrowRight className="size-4" />
            </Link>
            <p className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-paper/70">
              <Link href="/rescues" className="underline underline-offset-4 hover:text-paper">
                Rescues
              </Link>
              <Link href="/reports" className="underline underline-offset-4 hover:text-paper">
                Reports
              </Link>
              <Link href="/activity" className="underline underline-offset-4 hover:text-paper">
                Verified PayPal activity
              </Link>
              <Link href="/architecture" className="underline underline-offset-4 hover:text-paper">
                How it&apos;s built
              </Link>
            </p>
          </div>
          <div className="relative mx-auto grid size-48 shrink-0 place-items-center md:mx-0">
            <div aria-hidden className="absolute inset-6 rounded-full bg-[#8fe3ff]/20 blur-3xl" />
            <AgentAvatar glossy mood="happy" className="relative size-40" label="" />
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-60 text-sm text-ink-muted">Rescues failed monthly PayPal gifts, with you approving every fix.</p>
          </div>
          <FooterColumn title="App" links={[["Rescues", "/rescues"], ["Donors", "/donors"], ["Reports", "/reports"], ["Activity", "/activity"]]} />
          <FooterColumn title="Built with" links={[["PayPal Subscriptions", "https://developer.paypal.com/docs/subscriptions/"], ["AG Grid Studio", "https://www.ag-grid.com/studio/"], ["OpenAI", "https://platform.openai.com/docs"]]} />
          <FooterColumn title="About" links={[["How it works", "#how"], ["Architecture", "/architecture"]]} />
        </div>
        <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-ink-muted sm:px-8">PayPal sandbox only. Larkhaven Food Bank and its donors are fictional; no real money moves.</p>
      </footer>
    </div>
  );
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-ink-muted">
        {links.map(([label, href]) => (
          <li key={label}>
            {href.startsWith("http") ? (
              <a href={href} target="_blank" rel="noreferrer" className="hover:text-ink">
                {label}
              </a>
            ) : (
              <Link href={href} className="hover:text-ink">
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
