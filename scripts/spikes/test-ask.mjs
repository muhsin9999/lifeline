// Ask Lifeline with real model calls: activity, memory, an attached email, and a fresh look at a rescue.
import { chromium } from "playwright-core";
const [out, email, donor = "Grace"] = process.argv.slice(2);
const BASE = process.env.BASE ?? "http://localhost:3100";
const b = await chromium.launch({ executablePath: process.env.HOME + "/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const t0 = Date.now();
const log = (m) => console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s ${m}`);
await p.goto(`${BASE}/rescues`, { waitUntil: "networkidle" });
const rail = p.locator("aside").last();
async function ask(q, file) {
  const before = await rail.locator("p.rounded-2xl, div.rounded-2xl").count();
  if (file) await rail.locator("input[type=file]").setInputFiles(file);
  await rail.locator("input[placeholder='Ask Lifeline…']").fill(q);
  await rail.locator("button[aria-label='Send']").click();
  await p.waitForFunction(() => !document.querySelector("aside:last-of-type input[placeholder='Ask Lifeline…']")?.disabled, null, { timeout: 120000 });
  await p.waitForTimeout(600);
  const texts = await rail.locator(".flex-1 > *").allInnerTexts();
  log(`Q: ${q}\n   A: ${texts.at(-1).replace(/\s+/g, " ").slice(0, 320)}`);
}
await ask("What did we do last?");
await ask(`Remember: ${donor} lost her job last month, so be gentle with her.`);
await ask(`What does this email from ${donor} say?`, email);
await ask(`Please take a fresh look at ${donor}'s rescue.`);
const memo = await rail.locator("text=/What Lifeline remembers \\(\\d+\\)/").innerText().catch(() => "none");
log(`memory: ${memo}`);
await p.screenshot({ path: `${out}/lifeline-ask.png` });
await p.goto(`${BASE}/donors`, { waitUntil: "networkidle" });
await p.click(`a:has-text('${donor}')`);
await p.waitForLoadState("networkidle");
log(`donor page memo shown: ${await p.isVisible("text=/What you told Lifeline about/")}`);
const rescue = await p.getAttribute("a:has-text('open the rescue')", "href").catch(() => null);
if (rescue) {
  await p.goto(BASE + rescue, { waitUntil: "networkidle" });
  for (let i = 0; i < 40 && (await p.isVisible("text=/Looking into|is looking/i")); i++) await p.waitForTimeout(2000);
  await p.waitForTimeout(3000);
  await p.reload({ waitUntil: "networkidle" });
  const diag = (await p.locator("main p.text-\\[15px\\]").first().innerText().catch(() => "")).replace(/\s+/g, " ");
  log(`new diagnosis: ${diag.slice(0, 300)}`);
  await p.screenshot({ path: `${out}/lifeline-rescue-after-memo.png`, fullPage: true });
}
console.log(errors.length ? "PAGE ERRORS " + JSON.stringify(errors.slice(0, 3)) : "no page errors");
await b.close();
