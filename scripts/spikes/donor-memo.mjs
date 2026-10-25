// Is the memo on Grace's donor page?
import { chromium } from "playwright-core";
const BASE = process.env.BASE ?? "http://localhost:3100";
const b = await chromium.launch({ executablePath: process.env.HOME + "/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome" });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(`${BASE}/donors`, { waitUntil: "networkidle" });
await p.click("main a[href^='/donors/']:has-text('Grace')");
await p.waitForURL(/donors\/[0-9a-f-]{36}/);
await p.waitForSelector("h1");
console.log("donor page memo shown:", await p.isVisible("text=/What you told Lifeline about Grace/"));
await p.screenshot({ path: process.argv[2] + "/lifeline-donor-memo.png" });
await b.close();
