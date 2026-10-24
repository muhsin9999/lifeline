// Phone-width screenshots of the app pages and the Ask panel: node scripts/spikes/phone-shots.mjs <baseUrl> <outDir>
import { chromium } from "@playwright/test";
const [base, out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome` });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !/\*{5}/.test(m.text()) && errors.push(m.text().slice(0, 200)));
for (const p of ["rescues", "donors", "activity", "reports"]) {
  await page.goto(`${base}/${p}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(p === "reports" ? 8000 : 2000);
  await page.screenshot({ path: `${out}/phone-${p}.png` });
}
await page.goto(`${base}/rescues`, { waitUntil: "networkidle" });
const rescue = page.locator('a[href^="/rescues/"]').first();
if (await rescue.count()) {
  await rescue.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}/phone-rescue.png`, fullPage: true });
}
await page.goto(`${base}/donors`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Ask Lifeline AI" }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/phone-ask.png` });
console.log(JSON.stringify({ errors }));
await browser.close();
