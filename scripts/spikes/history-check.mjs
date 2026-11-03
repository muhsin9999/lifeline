// Chat history in the rail: two conversations, switch, survive a page change. node … <base> <out-dir>
import { chromium } from "@playwright/test";
const [base, out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome` });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
const ok = (c, m) => console.log(c ? "PASS" : "FAIL", m);
const rail = p.locator("aside");
const ask = async (q) => {
  await rail.getByPlaceholder("Ask Lifeline…").fill(q); await rail.getByRole("button", { name: "Send" }).click();
  await rail.getByPlaceholder("Ask Lifeline…").and(p.locator(":enabled")).waitFor({ timeout: 90_000 }); await p.waitForTimeout(1500);
};
await p.goto(`${base}/rescues`, { waitUntil: "networkidle" });
await ask("Which donor gives the most each month?");
await rail.getByRole("button", { name: "New chat" }).click(); await p.waitForTimeout(300);
ok(!(await rail.getByText("Which donor gives the most each month?").count()), "New chat opens an empty conversation");
await ask("How many gifts failed this week?");
await rail.getByRole("button", { name: "Past conversations" }).click(); await p.waitForTimeout(400);
const items = await rail.locator('section[aria-label="Past conversations"] li').allInnerTexts();
ok(items.length === 2, `History lists 2: ${items.map((t) => t.split("\n")[0]).join(" | ")}`);
await p.screenshot({ path: `${out}/lifeline-history.png` });
await rail.getByRole("button", { name: /Which donor gives the most/ }).click(); await p.waitForTimeout(400);
ok((await rail.getByText("Which donor gives the most each month?").count()) === 1 && !(await rail.getByText("How many gifts failed this week?").count()), "picking it shows that conversation only");
await p.goto(`${base}/donors`, { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
ok((await rail.getByText("Which donor gives the most each month?").count()) === 1, "the open conversation follows to another page");
await p.screenshot({ path: `${out}/lifeline-history-switched.png` });
await b.close();
