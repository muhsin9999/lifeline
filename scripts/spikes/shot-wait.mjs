// Screenshot a page after a longer settle, capturing console errors: node scripts/spikes/shot-wait.mjs <url> <out.png> [ms]
import { chromium } from "@playwright/test";
const [url, out, ms = "9000"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome` });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !/licen|\*{10}/i.test(m.text()) && errors.push(m.text().slice(0, 200)));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(Number(ms));
await page.screenshot({ path: out });
console.log(JSON.stringify({ errors: errors.slice(0, 8) }, null, 1));
await browser.close();
