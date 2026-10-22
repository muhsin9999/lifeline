// Screenshot a local page: node scripts/spikes/shot.mjs <url> <out.png>
import { chromium } from "@playwright/test";
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome` });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.screenshot({ path: out });
console.log(JSON.stringify({ errors: errors.slice(0, 5) }, null, 1));
await browser.close();
