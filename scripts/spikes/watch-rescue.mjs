// Opens a donor's rescue and screenshots it as the agent works: node scripts/spikes/watch-rescue.mjs <base> <donor> <out-dir>
import { chromium } from "@playwright/test";
const [base, donor, out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome` });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${base}/rescues`, { waitUntil: "networkidle" });
await page.getByText(donor).first().click();
await page.waitForLoadState("networkidle");
for (const [i, ms] of [[1, 3500], [2, 3000], [3, 5000]]) {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: `${out}/live-${i}.png` });
}
await browser.close();
