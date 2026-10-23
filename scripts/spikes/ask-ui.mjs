// Asks a question in the rail and screenshots the steps and answer: node scripts/spikes/ask-ui.mjs <base> <question> <out-dir>
import { chromium } from "@playwright/test";
const [base, question, out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome` });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${base}/rescues`, { waitUntil: "networkidle" });
await page.getByPlaceholder("Ask Lifeline…").fill(question);
await page.getByRole("button", { name: "Send" }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/ask-working.png` });
await page.waitForTimeout(9000);
await page.screenshot({ path: `${out}/ask-answer.png` });
await browser.close();
