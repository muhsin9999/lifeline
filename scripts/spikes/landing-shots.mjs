// Screenshots of the landing page: node scripts/spikes/landing-shots.mjs <baseUrl> <outDir>
import { chromium } from "@playwright/test";
const [base, out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome` });
const errors = [];
for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${out}/landing-${name}-working.png` });
  await page.waitForTimeout(5500);
  await page.mouse.move(viewport.width * 0.2, 200);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/landing-${name}-hero.png` });
  await page.getByRole("button", { name: "Approve" }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/landing-${name}-approved.png` });
  await page.locator("#how").scrollIntoViewIfNeeded();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${out}/landing-${name}-full.png`, fullPage: true });
  await page.close();
}
console.log(JSON.stringify({ errors: errors.slice(0, 8) }));
await browser.close();
