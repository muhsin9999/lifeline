"use client";

import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  BanIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  MaximizeIcon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  ShieldCheckIcon,
  XIcon,
} from "lucide-react";
import { AgentAvatar } from "@/components/brand/agent-avatar";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CANNOT, DECISIONS, EDGES, JOURNEYS, LANES, NODES, REPO, type ArchNode } from "@/lib/architecture";
import { cn } from "@/lib/utils";
import { ArchCanvas, type CanvasState, FIT, type Look } from "./canvas";
import { NodeLogo } from "./node-logo";

type Tab = "map" | "journeys" | "trust" | "decisions";
const TABS: { id: Tab; label: string }[] = [
  { id: "map", label: "Map" },
  { id: "journeys", label: "Journeys" },
  { id: "trust", label: "Trust" },
  { id: "decisions", label: "Decisions" },
];
const STEP_MS = 2600;
const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

export function ArchitectureExplorer() {
  return (
    <ReactFlowProvider>
      <Explorer />
    </ReactFlowProvider>
  );
}

function useDesktop() {
  const [desktop, setDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const q = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(q.matches);
    update();
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);
  return desktop;
}

function Explorer() {
  const desktop = useDesktop();
  const [tab, setTab] = useState<Tab>("map");
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [journeyId, setJourneyId] = useState(JOURNEYS[0].id);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [trust, setTrust] = useState(true);
  const journey = JOURNEYS.find((j) => j.id === journeyId)!;
  const last = journey.steps.length - 1;

  // Playback: one step every few seconds; it stops by itself on the last step.
  const running = playing && step < last;
  useEffect(() => {
    if (!running || tab !== "journeys") return;
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [running, step, tab]);

  const state = useMemo<CanvasState>(() => {
    const looks: Record<string, Look> = {};
    const edgeLooks: CanvasState["edgeLooks"] = {};
    const badges: Record<string, string> = {};
    let call: CanvasState["call"] = null;
    const q = query.trim().toLowerCase();
    if (tab === "journeys") {
      const now = journey.steps[step];
      const seen = new Set(journey.steps.slice(0, step).flatMap((s) => s.nodes));
      for (const n of NODES) looks[n.id] = now.nodes.includes(n.id) ? "lit" : seen.has(n.id) ? "visited" : "dim";
      for (const e of EDGES) edgeLooks[e.id] = now.edges.includes(e.id) ? "active" : "dim";
      if (now.call) call = { node: now.nodes.find((id) => byId[id].lane !== "people") ?? now.nodes[0], text: now.call };
    } else if (tab === "trust" && trust) {
      for (const n of NODES) {
        looks[n.id] = n.trust ? "lit" : "dim";
        if (n.trust) badges[n.id] = n.trust;
      }
      for (const e of EDGES) edgeLooks[e.id] = e.kind === "gate" ? "active" : "dim";
    } else if (q) {
      for (const n of NODES) looks[n.id] = `${n.title} ${n.sub} ${n.summary}`.toLowerCase().includes(q) ? "lit" : "dim";
    } else {
      const focus = hovered ?? selected;
      if (focus) {
        const linked = EDGES.filter((e) => e.from === focus || e.to === focus);
        const near = new Set([focus, ...linked.flatMap((e) => [e.from, e.to])]);
        for (const n of NODES) looks[n.id] = n.id === focus ? "lit" : near.has(n.id) ? "normal" : "dim";
        for (const e of EDGES) edgeLooks[e.id] = linked.includes(e) ? "active" : "dim";
      }
    }
    return { looks, edgeLooks, badges, call, selected };
  }, [tab, journey, step, trust, query, hovered, selected]);

  const chooseJourney = (id: string) => {
    setJourneyId(id);
    setStep(0);
    setPlaying(true);
  };
  const goTab = (t: Tab) => {
    setTab(t);
    setSelected(null);
    if (t === "journeys") {
      setStep(0);
      setPlaying(true);
    }
  };

  return (
    <div className="flex h-svh flex-col bg-paper text-ink">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-surface px-3 sm:px-4">
        <Link href="/" aria-label="Lifeline home" className="shrink-0">
          <Logo size="sm" className="max-sm:[&>span:last-child]:hidden" />
        </Link>
        <span className="hidden text-sm text-muted-foreground md:inline">Architecture</span>
        <nav aria-label="Views" className="ml-1 flex min-w-0 gap-0.5 overflow-x-auto sm:ml-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => goTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={cn("rounded-md px-2 py-1.5 text-[0.82rem] font-medium whitespace-nowrap transition-colors sm:px-2.5 sm:text-sm", tab === t.id ? "bg-brand-tint text-brand-strong" : "text-muted-foreground hover:text-ink")}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {desktop && tab !== "decisions" ? (
            <label className="relative hidden xl:block">
              <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (tab !== "map") setTab("map");
                }}
                placeholder="Search parts, APIs, files"
                aria-label="Search the map"
                className="h-9 w-64 rounded-lg border bg-paper pr-3 pl-8 text-sm outline-none focus-visible:border-ink"
              />
            </label>
          ) : null}
          {desktop && tab !== "decisions" ? <FitButton /> : null}
          <Link href="/rescues" className="hidden items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted sm:inline-flex">
            Open the app <ArrowRightIcon aria-hidden className="size-3.5" />
          </Link>
        </div>
      </header>

      {tab === "decisions" ? (
        <Decisions />
      ) : desktop === null ? (
        <div className="flex-1" />
      ) : desktop ? (
        <div className="flex min-h-0 flex-1">
          {tab === "journeys" ? <JourneyList journeyId={journeyId} step={step} onJourney={chooseJourney} onStep={(i) => { setStep(i); setPlaying(false); }} /> : null}
          <div className="relative min-w-0 flex-1">
            <ArchCanvas state={state} layout={`${tab}:${!!selected || tab === "trust"}`} onSelect={setSelected} onHover={setHovered} />
            <Key tab={tab} />
            <ZoomButtons />
            {tab === "journeys" ? <Playback steps={journey.steps.length} step={step} title={journey.steps[step].title} sub={journey.steps[step].sub} playing={running} onPlay={() => { if (step >= last) { setStep(0); setPlaying(true); } else setPlaying(!running); }} onStep={(i) => { setStep(i); setPlaying(false); }} done={step === last} /> : null}
          </div>
          <AnimatePresence initial={false}>
            {selected ? (
              <Panel key="node">
                <NodeDetail node={byId[selected]} onClose={() => setSelected(null)} onSelect={setSelected} />
              </Panel>
            ) : tab === "trust" ? (
              <Panel key="trust">
                <TrustPanel on={trust} onToggle={setTrust} onSelect={setSelected} />
              </Panel>
            ) : null}
          </AnimatePresence>
        </div>
      ) : (
        <MobileView tab={tab} journeyId={journeyId} onJourney={chooseJourney} />
      )}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <m.aside initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }} transition={{ duration: 0.2 }} className="w-[23rem] shrink-0 overflow-y-auto border-l bg-surface">
      {children}
    </m.aside>
  );
}

function FitButton() {
  const flow = useReactFlow();
  return (
    <Button size="sm" variant="outline" onClick={() => flow.fitView({ ...FIT, duration: 400 })}>
      <MaximizeIcon aria-hidden /> Fit to view
    </Button>
  );
}

function ZoomButtons() {
  const flow = useReactFlow();
  return (
    <div className="absolute right-4 bottom-4 z-10 flex overflow-hidden rounded-lg border bg-surface shadow-soft">
      <button type="button" aria-label="Zoom out" onClick={() => flow.zoomOut({ duration: 200 })} className="grid size-9 place-items-center hover:bg-muted"><MinusIcon aria-hidden className="size-4" /></button>
      <button type="button" aria-label="Zoom in" onClick={() => flow.zoomIn({ duration: 200 })} className="grid size-9 place-items-center border-l hover:bg-muted"><PlusIcon aria-hidden className="size-4" /></button>
    </div>
  );
}

function Key({ tab }: { tab: Tab }) {
  return (
    <div className="absolute bottom-4 left-4 z-10 w-48 rounded-lg border bg-surface/95 px-3 py-2.5 text-[0.72rem] shadow-soft">
      <p className="mb-1.5 font-semibold">Key</p>
      <p className="flex items-center gap-2"><span className="h-px w-6 bg-[#9aa1a9]" /> Lifeline calls it</p>
      <p className="flex items-center gap-2"><span className="w-6 border-t border-dashed border-[#9aa1a9]" /> An event, or the donor</p>
      <p className="flex items-center gap-2"><span className="h-0.5 w-6 bg-caution" /> Needs Tunde’s approval</p>
      {tab !== "map" ? <p className="flex items-center gap-2"><span className="h-0.5 w-6 bg-ink" /> Active now</p> : <p className="mt-1 text-muted-foreground">Hover or click any part.</p>}
    </div>
  );
}

function NodeDetail({ node, onClose, onSelect }: { node: ArchNode; onClose: () => void; onSelect: (id: string) => void }) {
  const lane = LANES.find((l) => l.id === node.lane)!;
  const links = EDGES.filter((e) => e.from === node.id || e.to === node.id);
  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-3">
        {node.logo === "agent" ? <AgentAvatar glossy mood="idle" label="" className="size-14" /> : <NodeLogo logo={node.logo} className="size-12" />}
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"><XIcon aria-hidden className="size-4" /></button>
      </div>
      <h2 className="mt-3 text-xl font-semibold tracking-[-0.01em]">{node.title}</h2>
      <p className="mt-1 flex flex-wrap gap-1.5">
        <span className="rounded-md border px-2 py-0.5 text-xs">{lane.title}</span>
        <span className="rounded-md border px-2 py-0.5 font-mono text-xs text-muted-foreground">{node.sub}</span>
      </p>
      <p className="mt-4 text-sm text-pretty">{node.summary}</p>
      {node.trust ? <p className="mt-3 flex items-center gap-2 rounded-lg bg-recovered-tint px-3 py-2 text-sm font-medium text-recovered"><ShieldCheckIcon aria-hidden className="size-4 shrink-0" /> {node.trust}</p> : null}
      <dl className="mt-4 divide-y rounded-lg border text-sm">
        {node.facts.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[6.5rem_1fr] gap-3 px-3 py-2">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="min-w-0">{v}</dd>
          </div>
        ))}
      </dl>
      {links.length ? (
        <section className="mt-5">
          <h3 className="mb-2 text-sm font-semibold">Connections</h3>
          <ul className="space-y-1">
            {links.map((e) => {
              const other = byId[e.from === node.id ? e.to : e.from];
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => onSelect(other.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
                    <span className="text-muted-foreground">{e.from === node.id ? "→" : "←"}</span>
                    <span className="font-medium">{other.title}</span>
                    <span className="truncate text-xs text-muted-foreground">{e.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {node.source?.length ? (
        <section className="mt-5">
          <h3 className="mb-2 text-sm font-semibold">Code</h3>
          <ul className="space-y-1">
            {node.source.map((p) => (
              <li key={p}>
                <a href={`${REPO}/${p}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-mono text-xs text-ink hover:underline">
                  {p} <ExternalLinkIcon aria-hidden className="size-3" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function TrustPanel({ on, onToggle, onSelect }: { on: boolean; onToggle: (v: boolean) => void; onSelect: (id: string) => void }) {
  return (
    <div className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheckIcon aria-hidden className="size-5 text-recovered" /> Trust</h2>
        <button type="button" aria-pressed={on} onClick={() => onToggle(!on)} className="rounded-full border px-3 py-1 text-xs aria-pressed:border-recovered/40 aria-pressed:bg-recovered-tint aria-pressed:text-recovered">
          {on ? "Lit on the map" : "Light it up"}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Everything that keeps the AI safe, lit up on the map.</p>
      <h3 className="mt-5 text-sm font-semibold">What the AI can’t do</h3>
      <ul className="mt-2 space-y-1">
        {CANNOT.map((c) => (
          <li key={c.title}>
            <button type="button" onClick={() => onSelect(c.node)} className="flex w-full gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted">
              <BanIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-risk" />
              <span>
                <span className="block text-sm font-medium">{c.title}</span>
                <span className="block text-xs text-muted-foreground text-pretty">{c.how}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex gap-2.5 rounded-lg bg-recovered-tint px-3 py-2.5 text-sm text-recovered">
        <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>Layers work together: read-only tools, fixes checked in code, Tunde’s approval, a claim before every PayPal write, and verified webhooks.</span>
      </p>
    </div>
  );
}

function JourneyList({ journeyId, step, onJourney, onStep }: { journeyId: string; step: number; onJourney: (id: string) => void; onStep: (i: number) => void }) {
  const journey = JOURNEYS.find((j) => j.id === journeyId)!;
  return (
    <aside className="w-[19rem] shrink-0 overflow-y-auto border-r bg-surface p-4">
      <h2 className="text-sm font-semibold">Journeys</h2>
      <ul className="mt-2 space-y-1">
        {JOURNEYS.map((j) => (
          <li key={j.id}>
            <button type="button" onClick={() => onJourney(j.id)} className={cn("w-full rounded-lg border px-3 py-2 text-left", j.id === journeyId ? "border-ink/20 bg-paper-deep" : "border-transparent hover:bg-muted")}>
              <span className="block text-sm font-medium">{j.title}</span>
              <span className="block text-xs text-muted-foreground">{j.steps.length} steps · {j.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
      <ol className="mt-5 space-y-0.5 border-t pt-4">
        {journey.steps.map((s, i) => (
          <li key={s.title}>
            <button type="button" onClick={() => onStep(i)} className={cn("flex w-full gap-3 rounded-lg px-2 py-2 text-left", i === step ? "bg-paper-deep" : "hover:bg-muted")}>
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-xs", i < step && "border-ink bg-ink text-white", i === step && "border-ink bg-surface font-semibold text-ink")}>
                {i < step ? <CheckIcon aria-hidden className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className={cn("block text-sm", i === step && "font-medium")}>{s.title}</span>
                <span className="block text-xs text-muted-foreground">{s.sub}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function Playback({ steps, step, title, sub, playing, onPlay, onStep, done }: { steps: number; step: number; title: string; sub: string; playing: boolean; onPlay: () => void; onStep: (i: number) => void; done: boolean }) {
  return (
    <div className="absolute bottom-4 left-1/2 z-10 flex w-[min(44rem,calc(100%-8rem))] -translate-x-1/2 items-center gap-4 rounded-xl border bg-surface px-4 py-3 shadow-soft">
      <button type="button" onClick={onPlay} aria-label={playing ? "Pause" : "Play"} className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-white">
        {playing ? <PauseIcon aria-hidden className="size-5" /> : <PlayIcon aria-hidden className="size-5 translate-x-px" />}
      </button>
      <div className="w-44 min-w-0 shrink-0">
        <p className="text-xs text-muted-foreground">Step {step + 1} of {steps}</p>
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </div>
      <div className="flex min-w-0 flex-1 items-center">
        {Array.from({ length: steps }, (_, i) => (
          <span key={i} className="flex flex-1 items-center last:flex-none">
            <button type="button" aria-label={`Step ${i + 1}`} onClick={() => onStep(i)} className={cn("size-3 shrink-0 rounded-full border-2 transition-colors", i <= step ? "border-ink bg-ink" : "border-line bg-surface", i === step && "ring-4 ring-paper-deep")} />
            {i < steps - 1 ? <span className={cn("h-0.5 flex-1", i < step ? "bg-ink" : "bg-line")} /> : null}
          </span>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" aria-label="Previous step" disabled={step === 0} onClick={() => onStep(step - 1)} className="grid size-8 place-items-center rounded-md hover:bg-muted disabled:opacity-30"><ChevronLeftIcon aria-hidden className="size-4" /></button>
        <button type="button" aria-label="Next step" disabled={done} onClick={() => onStep(step + 1)} className="grid size-8 place-items-center rounded-md hover:bg-muted disabled:opacity-30"><ChevronRightIcon aria-hidden className="size-4" /></button>
        <AgentAvatar glossy mood={done ? "happy" : playing ? "working" : "idle"} label="" className="ml-1 size-8" />
      </div>
    </div>
  );
}

function Decisions() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Decisions</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">What we chose, and why.</p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {DECISIONS.map((d) => (
            <article key={d.area} className="rounded-[10px] border bg-surface p-4">
              <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">{d.area}</p>
              <h2 className="mt-1 font-semibold">{d.chose}</h2>
              <p className="mt-1.5 text-sm text-pretty">{d.why}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Phones: the same data as lists, with a bottom sheet for any part. */
function MobileView({ tab, journeyId, onJourney }: { tab: Tab; journeyId: string; onJourney: (id: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const journey = JOURNEYS.find((j) => j.id === journeyId)!;
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {tab === "journeys" ? (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {JOURNEYS.map((j) => (
              <button key={j.id} type="button" onClick={() => onJourney(j.id)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm", j.id === journeyId ? "border-ink bg-paper-deep font-medium text-ink" : "bg-surface")}>{j.title}</button>
            ))}
          </div>
          <ol className="mt-3 space-y-2">
            {journey.steps.map((s, i) => (
              <li key={s.title} className="rounded-[10px] border bg-surface p-3">
                <p className="flex items-center gap-2 text-sm font-medium"><span className="grid size-6 place-items-center rounded-full bg-ink text-xs text-white">{i + 1}</span>{s.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>
                {s.call ? <p className="mt-2 rounded-md bg-paper px-2 py-1.5 font-mono text-[0.7rem] break-words">{s.call}</p> : null}
              </li>
            ))}
          </ol>
        </>
      ) : tab === "trust" ? (
        <TrustPanel on onToggle={() => {}} onSelect={setOpen} />
      ) : (
        <div className="space-y-3">
          {LANES.map((l) => (
            <section key={l.id} className="rounded-[12px] border bg-surface">
              <h2 className="border-b px-4 py-2.5 text-sm font-semibold">{l.title} <span className="font-normal text-muted-foreground">· {l.blurb}</span></h2>
              <ul className="divide-y">
                {NODES.filter((n) => n.lane === l.id).map((n) => (
                  <li key={n.id}>
                    <button type="button" onClick={() => setOpen(n.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
                      <NodeLogo logo={n.logo} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{n.title}</span>
                        <span className="block truncate font-mono text-[0.68rem] text-muted-foreground">{n.sub}</span>
                      </span>
                      <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent side="bottom" showCloseButton={false} className="max-h-[85svh] overflow-y-auto rounded-t-2xl">
          <SheetTitle className="sr-only">{open ? byId[open].title : "Part"}</SheetTitle>
          {open ? <NodeDetail node={byId[open]} onClose={() => setOpen(null)} onSelect={setOpen} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
