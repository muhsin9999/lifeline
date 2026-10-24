// Step-1 audit screenshots: node scripts/spikes/audit-shots.mjs <baseUrl> <outDir>
import { chromium } from "@playwright/test";
const [base, out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome` });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
for (const p of ["", "rescues", "donors"]) {
  await page.goto(`${base}/${p}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/step1-${p || "landing"}.png` });
}
await page.goto(`${base}/donors`, { waitUntil: "networkidle" });
await page.locator("ul li a").first().click();
await page.waitForLoadState("networkidle");
await page.locator("details summary").first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/step1-donor-gift-open.png`, fullPage: true });
console.log(JSON.stringify({ errors }));
await browser.close();
