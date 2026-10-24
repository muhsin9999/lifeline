// Opens the live dashboard, screenshots it, clicks one prompt starter in the AI panel and screenshots the reply.
// node scripts/spikes/studio-ask.mjs <url> <prompt label> <out-dir>
import { chromium } from "@playwright/test";
const [url, label, out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome` });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !/licen|\*{10}/i.test(m.text()) && errors.push(m.text().slice(0, 200)));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(9000);
await page.screenshot({ path: `${out}/live-dashboard.png` });
await page.getByText(label, { exact: true }).click();
for (const [i, ms] of [[1, 8000], [2, 20000], [3, 30000]]) {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: `${out}/live-ai-${i}.png` });
}
console.log(JSON.stringify({ errors: errors.slice(0, 8) }, null, 1));
await browser.close();
