// On a rescue page, presses "look again" and screenshots the agent as it works: node scripts/spikes/look-again.mjs <base> <donor> <out-dir>
import { chromium } from "@playwright/test";
const [base, donor, out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome` });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${base}/rescues`, { waitUntil: "networkidle" });
await page.getByText(donor).first().click();
await page.waitForLoadState("networkidle");
await page.getByText("Ask Lifeline AI to look again").click();
for (const [i, ms] of [[1, 4000], [2, 5000], [3, 6000], [4, 12000]]) {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: `${out}/agent-${i}.png` });
}
await browser.close();
