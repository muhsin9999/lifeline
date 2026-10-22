// Opens a donor's rescue, approves the chosen fix and screenshots the result: node scripts/spikes/approve.mjs <base> <donor> <out.png> [fix label]
import { chromium } from "@playwright/test";
const [base, donor, out, fixLabel] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome` });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${base}/rescues`, { waitUntil: "networkidle" });
await page.getByText(donor).first().click();
await page.waitForLoadState("networkidle");
await page.waitForTimeout(2500);
if (fixLabel) {
  await page.getByText(/other fix/).click();
  await page.getByText(fixLabel, { exact: true }).click();
}
await page.getByRole("button", { name: /^Approve/ }).click();
await page.waitForTimeout(6000);
await page.screenshot({ path: out });
await browser.close();
