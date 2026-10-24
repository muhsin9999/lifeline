import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { HeroAgent } from "@/components/landing/hero-agent";
import { HeroLine } from "@/components/landing/hero-line";
import { RescueStory } from "@/components/landing/rescue-story";

export const metadata: Metadata = { title: { absolute: "Lifeline: failed gifts, brought back" } };

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

      <section className="relative">
        <HeroLine />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-20 sm:px-8 lg:grid-cols-[1fr_auto] lg:gap-16 lg:pt-16 lg:pb-28">
          <div>
            <h1 className="text-[clamp(2.75rem,7vw,5.25rem)] leading-[0.98] font-bold tracking-[-0.045em] text-balance">
              Failed gifts,
              <br />
              brought back.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-muted sm:text-xl">Lifeline helps a small food bank win back monthly PayPal donations that fail.</p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <Link href="/rescues" className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-6 font-semibold text-white shadow-[0_8px_24px_-8px_var(--brand)] transition-colors hover:bg-brand-strong">
                See it live <ArrowRight className="size-4" />
              </Link>
              <a href="#how" className="text-sm font-medium text-ink-muted hover:text-ink">
                How it works
              </a>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <HeroAgent />
          </div>
        </div>
      </section>

      <section id="how" className="scroll-mt-8 border-t border-line bg-paper-deep/60 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <h2 className="text-center text-3xl font-bold tracking-[-0.03em] sm:text-4xl">How a rescue works</h2>
          <p className="mx-auto mt-3 max-w-md text-center text-ink-muted">From a failed payment to a donor still giving, with you approving every step.</p>
          <div className="mt-14">
            <RescueStory />
          </div>
        </div>
      </section>

      <section className="px-4 py-16 text-center">
        <p className="text-sm text-ink-muted">Built on</p>
        <p className="mt-2 text-lg font-semibold tracking-tight text-balance text-ink/70">PayPal Subscriptions · AG Grid Studio · OpenAI</p>
        <Link href="/rescues" className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm font-semibold shadow-soft hover:border-ink/20">
          Open the app <ArrowRight className="size-4" />
        </Link>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Logo size="sm" />
          <span>PayPal sandbox only. Larkhaven Food Bank and its donors are fictional; no real money moves.</span>
        </div>
      </footer>
    </div>
  );
}
