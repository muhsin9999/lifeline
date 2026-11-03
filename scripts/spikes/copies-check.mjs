// Two visitors, two practice copies: what one approves never shows for the other; the live key opens the real one.
// Usage: BASE=… LIVE=<key> node scripts/spikes/copies-check.mjs <outdir>
import { chromium } from "/home/momoh_mustapha/projects/lifeline/node_modules/playwright-core/index.mjs";
const out = process.argv[2];
const BASE = process.env.BASE ?? "http://localhost:3100";
const b = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome` });
const ok = (c, m) => console.log(c ? "PASS" : "FAIL", m);
const visitor = async () => (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const open = async (p) => {
  await p.goto(`${BASE}/rescues`); await p.waitForLoadState("networkidle");
  return p.locator('a[href^="/rescues/"]', { hasText: "Fix ready" }).count();
};
const a = await visitor();
const before = await open(a);
ok(await a.getByText("Your practice copy.").isVisible(), `visitor A sees the practice label (${before} open rescues)`);
await a.screenshot({ path: `${out}/copies-1-practice-label.png` });
// A pauses the first rescue (no PayPal write in a copy).
await a.locator('a[href^="/rescues/"]', { hasText: "Fix ready" }).first().click();
await a.getByRole("button", { name: /^Approve/ }).waitFor({ timeout: 90_000 });
await a.screenshot({ path: `${out}/copies-1b-rescue.png`, fullPage: true });
console.log("buttons:", (await a.getByRole("button").allInnerTexts()).filter(Boolean).slice(0, 20).join(" | "));
const more = a.getByRole("button", { name: /other fix/ });
if (await more.count()) await more.click();
await a.getByRole("button", { name: /Pause for now/ }).click();
await a.getByRole("button", { name: /^Approve: pause for now/i }).click();
const toast = a.getByText(/Practice copy, so PayPal wasn.t changed/);
await toast.waitFor({ timeout: 30_000 });
ok(true, `approve in a copy: "${(await toast.innerText()).slice(0, 140)}"`);
await a.screenshot({ path: `${out}/copies-2-practice-toast.png` });
ok((await open(a)) === before - 1, "A's copy now has one rescue fewer");
// B is a new visitor: a fresh copy, untouched.
const bb = await visitor();
ok((await open(bb)) === before, "visitor B still sees every rescue");
// The owner's key opens the real workspace, without the label.
if (process.env.LIVE) {
  const o = await visitor();
  await o.goto(`${BASE}/rescues?live=${process.env.LIVE}`); await o.waitForLoadState("networkidle");
  ok(!(await o.getByText("Your practice copy.").count()), "the live key opens the real workspace (no practice label)");
}
await b.close();
