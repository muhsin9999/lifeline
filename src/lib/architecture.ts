// The architecture map's single source of truth: every lane, node, connection, journey, trust rule and decision
// on /architecture comes from here. Facts only: file paths are real, and numbers are dated and come from the live
// database's audit log or the test suite.

export const REPO = "https://github.com/muhsin9999/lifeline/blob/main";

export type LaneId = "people" | "web" | "agent" | "ai" | "paypal" | "data";
export type Logo = "paypal" | "vercel" | "neon" | "nextjs" | "resend" | "openai" | "agent" | "person" | "webhook" | "chart" | "chat" | "shield" | "gauge" | "send" | "wrench";

export const LANES: { id: LaneId; title: string; blurb: string }[] = [
  { id: "people", title: "People", blurb: "Who it's for" },
  { id: "web", title: "Lifeline web", blurb: "Next.js 16 on Vercel" },
  { id: "agent", title: "Agent & actions", blurb: "Runs after a request, or after an approval" },
  { id: "ai", title: "AI", blurb: "The model, and the code around it" },
  { id: "paypal", title: "PayPal sandbox", blurb: "What Lifeline calls and hears from" },
  { id: "data", title: "Data & email", blurb: "Records, and notes to donors" },
];

export type ArchNode = {
  id: string;
  lane: LaneId;
  title: string;
  /** One mono line: a route, a function or a model. */
  sub: string;
  logo: Logo;
  summary: string;
  facts: [string, string][];
  source?: string[];
  /** Shown on the Trust lens. */
  trust?: string;
};

export const NODES: ArchNode[] = [
  {
    id: "sam",
    lane: "people",
    title: "Fundraising officer",
    sub: "Sam, at a small food bank",
    logo: "person",
    summary: "Sees which monthly gifts failed and why, approves one fix per rescue, asks questions in plain words and builds reports.",
    facts: [["Approves", "Every change to a donor's PayPal subscription, and every note"], ["Works in", "Rescues, Donors, Reports, Activity"]],
  },
  {
    id: "donor",
    lane: "people",
    title: "Monthly donor",
    sub: "a PayPal subscription",
    logo: "person",
    summary: "Gives every month through a PayPal subscription. When a gift fails they may never know; Lifeline's note tells them kindly.",
    facts: [["Gives through", "PayPal Subscriptions"], ["Hears from", "A note Sam approved"]],
  },
  {
    id: "app",
    lane: "web",
    title: "Lifeline app",
    sub: "Next.js 16 · server actions",
    logo: "nextjs",
    summary: "Rescues, Donors and Activity. Every page reads live from the database; a rescue page refreshes itself while the agent works. Approving a fix is a server action, checked with zod.",
    facts: [["Runs on", "Vercel, deployed from GitHub"], ["Approve", "approveFix() → runFix()"], ["Look again", "Re-runs the diagnosis"]],
    source: ["src/app/(app)", "src/server/actions/rescue.ts"],
  },
  {
    id: "ask",
    lane: "web",
    title: "Ask Lifeline",
    sub: "POST /api/ask · streamed",
    logo: "chat",
    summary: "The chat rail on every page. The agent plans, reads Lifeline's own data with four read-only tools and answers; its steps stream to the rail as it works.",
    facts: [["Tools", "get_kpis, list_rescues, list_donors, giving_by_day"], ["Links", "Only to rescues that really exist"], ["Cap", "60 questions an hour"]],
    source: ["src/app/api/ask/route.ts", "src/server/ai/ask.ts"],
  },
  {
    id: "reports",
    lane: "web",
    title: "Reports",
    sub: "AG Studio 3.0 · /reports",
    logo: "chart",
    summary: "An AG Studio report over gifts, failed gifts and donors, with a custom heartbeat widget. AG Studio's own agents build charts from a plain-words request, through Lifeline's server.",
    facts: [["Data", "gifts · failedGifts · donors, joined by a calendar"], ["Widget", "giving-pulse (custom)"], ["AI", "AG's lead + data agents"]],
    source: ["src/components/dashboard/studio.tsx", "src/components/dashboard/pulse-widget.tsx", "src/server/studio-data.ts"],
  },
  {
    id: "webhook",
    lane: "web",
    title: "Webhook receiver",
    sub: "POST /api/paypal/webhook",
    logo: "webhook",
    summary: "Receives PayPal's events. Each delivery's signature is checked on the exact bytes PayPal sent before anything is stored. A failed payment opens a rescue; a completed sale records the gift and closes any rescue it recovers.",
    facts: [["Checks", "PayPal's certificate + CRC32 of the raw body; PayPal's verify API as a fallback"], ["Forged", "Rejected and logged (1 so far, a test)"], ["Then", "after(): starts the diagnosis"]],
    source: ["src/app/api/paypal/webhook/route.ts", "src/lib/paypal-signature.ts", "src/server/paypal/webhooks.ts"],
    trust: "Signature verified on raw bytes",
  },
  {
    id: "diagnose",
    lane: "agent",
    title: "Rescue agent",
    sub: "diagnose(failureId)",
    logo: "agent",
    summary: "Looks into a failed gift: its first move is a written plan, then it reads PayPal and the giving history with read-only tools, and returns a structured diagnosis, the fixes it suggests and a draft note.",
    facts: [
      ["Runs", "Right after the webhook answers (Next.js after())"],
      ["Tools", "4, all read-only"],
      ["Model", "gpt-5.4-mini"],
      ["Last run", "8.7 s · 2,731 in / 641 out tokens (24 Oct)"],
      ["If AI fails", "Standard fixes and a template note"],
      ["Evals", "30/30 runs passed · 10 scenarios × 3 (8 Nov)"],
    ],
    source: ["src/server/ai/rescue-agent.ts", "src/server/ai/rescue.ts", "src/server/ai/agent.ts", "evals/scenarios.ts"],
    trust: "4 read-only tools · no write access",
  },
  {
    id: "runfix",
    lane: "agent",
    title: "Fix runner",
    sub: "runFix()",
    logo: "wrench",
    summary: "Carries out the one fix Sam approved. It claims the action in the database before calling PayPal, sends PayPal a request id so a retry can't charge twice, and if PayPal's answer is lost it re-reads the subscription instead of guessing.",
    facts: [["Claims", "paypal_actions.claim_key is unique"], ["Retry", "PayPal-Request-Id = the claim"], ["Tests", "12 against a fake PayPal, all passing"]],
    source: ["src/server/paypal/actions.ts", "tests/fixes.test.ts", "paypal-plan.md"],
    trust: "Claimed before the write; never sent twice",
  },
  {
    id: "note",
    lane: "agent",
    title: "Note sender",
    sub: "sendNote()",
    logo: "send",
    summary: "Sends the note Sam approved (after any edits) to the donor, with a sandbox footer. In this demo every note goes to one test inbox.",
    facts: [["Sends with", "Resend"], ["Goes to", "A test inbox (sandbox)"]],
    source: ["src/server/mail.ts"],
  },
  {
    id: "openai",
    lane: "ai",
    title: "OpenAI",
    sub: "Responses API · gpt-5.4-mini",
    logo: "openai",
    summary: "The model behind the rescue agent, Ask Lifeline and AG Studio's agents. Structured outputs for the diagnosis; every call is in the audit log with its model.",
    facts: [["Diagnosis", "Forced plan, then tools, then a zod-checked result"], ["Audit", "ai.rescue.diagnose · ai.ask · ai.studio.turn"]],
    source: ["src/server/ai/client.ts", "src/app/api/studio-llm/responses/route.ts"],
  },
  {
    id: "fixfilter",
    lane: "ai",
    title: "Fix filter",
    sub: "allowedFixes() · code, not a model",
    logo: "shield",
    summary: "Whatever the model suggests, only fixes PayPal can really carry out right now survive: no retry or forgive when nothing is owed, no lower on a small gift, no pause on a paused gift.",
    facts: [["Kept", "Only fixes PayPal can do now"], ["Never offered", "Moving a billing date (PayPal can't)"]],
    source: ["src/server/ai/rescue-agent.ts", "src/lib/fixes.ts"],
    trust: "Drops fixes PayPal can't carry out",
  },
  {
    id: "caps",
    lane: "ai",
    title: "Spend caps",
    sub: "hourly limits, from the audit log",
    logo: "gauge",
    summary: "The public demo can't run up the AI bill: questions and AG Studio turns are counted in the audit log and capped per hour, with a friendly message when the cap is reached.",
    facts: [["Ask Lifeline", "60 an hour"], ["Reports AI", "300 turns an hour"]],
    source: ["src/app/api/ask/route.ts", "src/app/api/studio-llm/responses/route.ts"],
    trust: "Hourly caps on every public AI route",
  },
  {
    id: "subscriptions",
    lane: "paypal",
    title: "Subscriptions v1",
    sub: "APIMatic PayPal SDK",
    logo: "paypal",
    summary: "Where the donor's monthly gift lives. Lifeline reads it for the diagnosis and changes it only through the approved fix.",
    facts: [["Reads", "getSubscription"], ["Writes", "captureSubscription, suspendSubscription, patchSubscription, cancelSubscription"], ["Contract", "paypal-plan.md"]],
    source: ["src/server/paypal/sdk.ts", "src/server/paypal/actions.ts", "paypal-plan.md"],
  },
  {
    id: "events",
    lane: "paypal",
    title: "Webhooks",
    sub: "events + signing certificates",
    logo: "paypal",
    summary: "PayPal signs every delivery. Lifeline subscribes to the subscription lifecycle and to completed sales.",
    facts: [["Events", "BILLING.SUBSCRIPTION.PAYMENT.FAILED, PAYMENT.SALE.COMPLETED, BILLING.SUBSCRIPTION.* (activated, suspended, cancelled, expired, re-activated, updated)"]],
    source: ["scripts/register-webhook.mjs"],
  },
  {
    id: "neon",
    lane: "data",
    title: "Neon Postgres",
    sub: "donors · gifts · failures · notes · audit",
    logo: "neon",
    summary: "Every record: donors and their gifts, each rescue with the agent's steps, notes, PayPal events, claimed PayPal actions and the audit log.",
    facts: [["Branches", "dev for local work, main for the live site"], ["Unique", "One gift per PayPal transaction; one claim per action"]],
    source: ["src/db/schema.ts"],
    trust: "Every AI call and approval in the audit log",
  },
  {
    id: "resend",
    lane: "data",
    title: "Resend",
    sub: "email API",
    logo: "resend",
    summary: "Delivers the approved notes.",
    facts: [["From", "Lifeline, for Larkhaven Food Bank"]],
    source: ["src/server/mail.ts"],
  },
];

export type ArchEdge = { id: string; from: string; to: string; label: string; kind?: "flow" | "event" | "gate" };

export const EDGES: ArchEdge[] = [
  { id: "sam-app", from: "sam", to: "app", label: "reviews, approves" },
  { id: "sam-ask", from: "sam", to: "ask", label: "asks" },
  { id: "sam-reports", from: "sam", to: "reports", label: "asks for charts" },
  { id: "donor-subs", from: "donor", to: "subscriptions", label: "monthly gift", kind: "event" },
  { id: "events-webhook", from: "events", to: "webhook", label: "signed events", kind: "event" },
  { id: "webhook-neon", from: "webhook", to: "neon", label: "verified event, new rescue" },
  { id: "webhook-diagnose", from: "webhook", to: "diagnose", label: "after(): diagnose" },
  { id: "diagnose-openai", from: "diagnose", to: "openai", label: "plan + read-only tools" },
  { id: "diagnose-subs", from: "diagnose", to: "subscriptions", label: "getSubscription" },
  { id: "diagnose-filter", from: "diagnose", to: "fixfilter", label: "fixes checked in code" },
  { id: "diagnose-neon", from: "diagnose", to: "neon", label: "history in, diagnosis out" },
  { id: "app-runfix", from: "app", to: "runfix", label: "Sam approves", kind: "gate" },
  { id: "runfix-neon", from: "runfix", to: "neon", label: "claim before the write" },
  { id: "runfix-subs", from: "runfix", to: "subscriptions", label: "capture · suspend · patch · cancel" },
  { id: "runfix-note", from: "runfix", to: "note", label: "send the note" },
  { id: "note-resend", from: "note", to: "resend", label: "email" },
  { id: "resend-donor", from: "resend", to: "donor", label: "note arrives", kind: "event" },
  { id: "ask-openai", from: "ask", to: "openai", label: "plan + tools" },
  { id: "ask-neon", from: "ask", to: "neon", label: "read-only queries" },
  { id: "ask-caps", from: "ask", to: "caps", label: "hourly cap" },
  { id: "reports-openai", from: "reports", to: "openai", label: "AG agents, via the server" },
  { id: "reports-caps", from: "reports", to: "caps", label: "hourly cap" },
  { id: "app-neon", from: "app", to: "neon", label: "reads live" },
];

export type JourneyStep = { title: string; sub: string; nodes: string[]; edges: string[]; call?: string };
export type Journey = { id: string; title: string; blurb: string; steps: JourneyStep[] };

export const JOURNEYS: Journey[] = [
  {
    id: "fails",
    title: "A gift fails",
    blurb: "Cora's real rescue, 23 Oct",
    steps: [
      { title: "Cora's gift can't be charged", sub: "Her PayPal funding was removed", nodes: ["donor", "subscriptions"], edges: ["donor-subs"], call: "reason_code: PAYER_CANNOT_PAY · $1" },
      { title: "PayPal sends a signed event", sub: "Verified before it's stored", nodes: ["events", "webhook"], edges: ["events-webhook"], call: "BILLING.SUBSCRIPTION.PAYMENT.FAILED · signature verified" },
      { title: "A rescue opens by itself", sub: "Stored once, by PayPal's event id", nodes: ["webhook", "neon"], edges: ["webhook-neon"], call: "failures.status = new" },
      { title: "The agent writes a plan", sub: "Its forced first move", nodes: ["webhook", "diagnose", "openai"], edges: ["webhook-diagnose", "diagnose-openai"], call: "write_plan([“Read Cora's subscription”, …])" },
      { title: "It reads PayPal", sub: "Read-only, through the SDK", nodes: ["diagnose", "subscriptions"], edges: ["diagnose-subs"], call: "getSubscription → ACTIVE · 1 failed · $1 owed" },
      { title: "Code keeps the possible fixes", sub: "And saves the diagnosis", nodes: ["diagnose", "fixfilter", "neon"], edges: ["diagnose-filter", "diagnose-neon"], call: "kept: note, retry · recommended: note" },
      { title: "Sam approves the note", sub: "Nothing happens without it", nodes: ["sam", "app", "runfix"], edges: ["sam-app", "app-runfix"], call: "Approve · Send a note" },
      { title: "The note goes out", sub: "To the test inbox", nodes: ["runfix", "note", "resend", "donor"], edges: ["runfix-note", "note-resend", "resend-donor"], call: "“Your monthly gift to Larkhaven” · sent" },
    ],
  },
  {
    id: "retry",
    title: "A retry brings it back",
    blurb: "The retry fix, end to end",
    steps: [
      { title: "Sam approves a retry", sub: "Only offered when money is owed", nodes: ["sam", "app", "runfix"], edges: ["sam-app", "app-runfix"], call: "Approve · Retry the charge now" },
      { title: "The action is claimed first", sub: "A second click can't send it again", nodes: ["runfix", "neon"], edges: ["runfix-neon"], call: "insert paypal_actions (claim_key unique)" },
      { title: "Lifeline asks PayPal to charge", sub: "With the claim as the request id", nodes: ["runfix", "subscriptions"], edges: ["runfix-subs"], call: "captureSubscription({ capture_type: OUTSTANDING_BALANCE })" },
      { title: "PayPal confirms the sale", sub: "A signed, verified event", nodes: ["events", "webhook", "neon"], edges: ["events-webhook", "webhook-neon"], call: "PAYMENT.SALE.COMPLETED · gift recorded" },
      { title: "The rescue is recovered", sub: "Shown on Rescues and in Reports", nodes: ["neon", "app"], edges: ["app-neon"], call: "failures.status = recovered" },
    ],
  },
  {
    id: "ask",
    title: "Ask Lifeline",
    blurb: "A question in plain words",
    steps: [
      { title: "Sam asks a question", sub: "From the rail on any page", nodes: ["sam", "ask"], edges: ["sam-ask"], call: "“How much have we recovered?”" },
      { title: "The hourly cap is checked", sub: "Counted in the audit log", nodes: ["ask", "caps"], edges: ["ask-caps"], call: "ai.ask this hour < 60" },
      { title: "The agent plans and reads", sub: "Read-only tools over Lifeline's data", nodes: ["ask", "openai", "neon"], edges: ["ask-openai", "ask-neon"], call: "get_kpis → recovered this month" },
      { title: "The answer streams back", sub: "With links only to real rescues", nodes: ["ask", "sam"], edges: ["sam-ask"], call: "answer + “Open Cora's rescue”" },
    ],
  },
  {
    id: "report",
    title: "Build a report",
    blurb: "AG Studio's agents make a chart",
    steps: [
      { title: "Sam asks for a chart", sub: "In the Reports chat", nodes: ["sam", "reports"], edges: ["sam-reports"], call: "“Chart recovered money per week”" },
      { title: "AG Studio's agents plan it", sub: "Through Lifeline's server; the key stays there", nodes: ["reports", "openai", "caps"], edges: ["reports-openai", "reports-caps"], call: "POST /api/studio-llm/responses" },
      { title: "The chart lands on the report", sub: "Built from Lifeline's real rows", nodes: ["reports"], edges: [], call: "widget added: line chart · calendar::week" },
    ],
  },
];

/** What the AI cannot do, and the piece of the system that stops it. */
export const CANNOT: { title: string; how: string; node: string }[] = [
  { title: "Change a gift without Sam", how: "The agent's tools only read. PayPal writes happen only in runFix, which only an approval starts.", node: "runfix" },
  { title: "Suggest a fix PayPal can't do", how: "The fix filter keeps only fixes PayPal can carry out for this gift right now.", node: "fixfilter" },
  { title: "Charge a donor twice", how: "Each action is claimed before the call, and PayPal gets the claim as its request id.", node: "runfix" },
  { title: "Act on a forged PayPal event", how: "Every webhook is verified against PayPal's signature before it's stored.", node: "webhook" },
  { title: "See a donor's card or bank", how: "PayPal never shows them to a nonprofit; the tools return only PayPal's reason code and history.", node: "diagnose" },
  { title: "Run up the AI bill", how: "Every public AI route has an hourly cap counted in the audit log.", node: "caps" },
];

export type Decision = { area: string; chose: string; why: string };

export const DECISIONS: Decision[] = [
  { area: "Agent shape", chose: "Code runs the rescue; the model does one job", why: "Receiving the event, filtering fixes, asking for approval and calling PayPal are fixed steps in code. The model is used where judgement helps: working out why a gift failed and writing a kind note." },
  { area: "Trust", chose: "Code checks the model", why: "The fix filter, the approval gate and the claim-before-write are plain code with tests, so a model mistake can't reach PayPal." },
  { area: "Model", chose: "gpt-5.4-mini", why: "A rescue is a small, structured job. The last live diagnosis took 8.7 seconds and about 3,400 tokens (24 Oct)." },
  { area: "PayPal Subscriptions", chose: "The SDK from APIMatic's PayPal Context Plugin", why: "Typed requests and errors, and a contract sheet (paypal-plan.md) for every write: claim first, re-read if the answer is lost, map each refusal to a clear message." },
  { area: "Webhook security", chose: "Verify the signature on the raw bytes", why: "PayPal signs the exact body it sent, so the certificate check runs on the original bytes, with PayPal's verify API as a fallback." },
  { area: "Background work", chose: "Next.js after() on Vercel", why: "The webhook answers PayPal at once and the diagnosis runs right after. It's short and safe to re-run, and “Look again” runs it on demand." },
  { area: "Fixes offered", chose: "Only what PayPal can really do", why: "PayPal can't move a billing date, so Lifeline never offers that. Lowering a gift only applies to charges more than 10 days away, and the card says so." },
  { area: "Reports", chose: "AG Studio with its own agents", why: "A fundraiser can ask for a chart in plain words. The agents call the model through Lifeline's server, so the key never reaches the browser, with an hourly cap." },
  { area: "Notes", chose: "Drafted by AI, approved by a person, sent by Resend", why: "The donor hears from the nonprofit, never from a bot acting alone. In the demo every note goes to one test inbox." },
  { area: "Data", chose: "Neon Postgres, two branches", why: "Local work runs on a dev branch with test donors; the live site runs on main with real sandbox subscriptions only." },
  { area: "Hosting", chose: "Vercel, deployed from GitHub", why: "Every push deploys; webhooks and pages run on the same Next.js app." },
];
