// Reports page screenshots, default and customizing: node scripts/spikes/reports-shots.mjs <baseUrl> <outDir>
import { chromium } from "@playwright/test";
const [base, out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome` });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !/licen|\*{10}/i.test(m.text()) && errors.push(m.text().slice(0, 200)));
await page.goto(`${base}/reports`, { waitUntil: "networkidle" });
await page.waitForTimeout(9000);
await page.screenshot({ path: `${out}/reports.png` });
await page.getByRole("button", { name: "Customize" }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/reports-customize.png` });
console.log(JSON.stringify({ errors: errors.slice(0, 6) }));
await browser.close();
