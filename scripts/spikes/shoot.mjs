// Screenshots the main screens for design review: node scripts/spikes/shoot.mjs <base-url> <out-dir>
import { chromium } from "@playwright/test";
const [base, out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome` });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${base}/rescues`, { waitUntil: "networkidle" });
await page.waitForTimeout(3500);
await page.screenshot({ path: `${out}/01-rescues.png` });
await page.mouse.move(760, 330);
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/02-pulse-hover.png` });
await page.locator("main ul li a").first().click();
await page.waitForLoadState("networkidle");
await page.waitForTimeout(5000);
await page.screenshot({ path: `${out}/03-rescue.png` });
console.log(JSON.stringify({ errors }));
await browser.close();
