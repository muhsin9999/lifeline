// Resumes a donor's suspended gift from their donor page, in the REAL workspace (real activateSubscription).
// Usage: node --env-file=.env.local scripts/spikes/live-resume-donor.mjs "Cora Reed" <outdir>
import { chromium } from "/home/momoh_mustapha/projects/lifeline/node_modules/playwright-core/index.mjs";
const [name, out] = process.argv.slice(2);
const BASE = "https://lifeline-giving.vercel.app";
const b = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome` });
const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
await p.goto(`${BASE}/donors?live=${process.env.LIVE_WORKSPACE_KEY}`); await p.waitForLoadState("networkidle");
if (await p.getByText("Your practice copy.").count()) throw new Error("not the real workspace");
await p.getByRole("link", { name: new RegExp(name) }).first().click();
const resume = p.getByRole("button", { name: /^Resume .*gift$/ }).first();
await resume.waitFor({ timeout: 90_000 });
await p.screenshot({ path: `${out}/4-resume-before.png`, fullPage: true });
await resume.click();
const toast = p.locator("[data-sonner-toast]").first();
await toast.waitFor({ timeout: 90_000 });
console.log("toast:", (await toast.innerText()).trim());
await p.waitForTimeout(3000);
await p.reload(); await p.waitForLoadState("networkidle");
await p.screenshot({ path: `${out}/5-resume-after.png`, fullPage: true });
console.log("suspended banner still shown:", await p.getByText("PayPal suspended").count());
await b.close();
