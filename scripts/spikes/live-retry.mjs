// The real recovery, in the REAL workspace: approve "Retry the charge now" on one rescue. Real PayPal capture.
// Usage: node --env-file=.env.local scripts/spikes/live-retry.mjs <rescueId> <outdir>
import { chromium } from "/home/momoh_mustapha/projects/lifeline/node_modules/playwright-core/index.mjs";
const [id, out] = process.argv.slice(2);
const BASE = "https://lifeline-giving.vercel.app";
const b = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome` });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(`${BASE}/rescues/${id}?live=${process.env.LIVE_WORKSPACE_KEY}`);
await p.getByRole("button", { name: /^Approve/ }).waitFor({ timeout: 90_000 });
if (await p.getByText("Your practice copy.").count()) throw new Error("not the real workspace");
await p.screenshot({ path: `${out}/1-before.png`, fullPage: true });
const more = p.getByRole("button", { name: /other fix/ });
if (await more.count()) await more.click();
await p.getByRole("button", { name: /Retry the charge now/ }).click();
await p.screenshot({ path: `${out}/2-retry-chosen.png`, fullPage: true });
await p.getByRole("button", { name: /^Approve: retry the charge now/i }).click();
const toast = p.locator("[data-sonner-toast]").first();
await toast.waitFor({ timeout: 90_000 });
console.log("toast:", await toast.innerText());
await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/3-after.png`, fullPage: true });
await b.close();
