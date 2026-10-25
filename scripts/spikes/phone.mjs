// Phone screenshots of Lifeline pages + horizontal overflow check: BASE=... node scripts/spikes/phone.mjs <out> [tag]
import { chromium } from "@playwright/test";
const [out, tag = "before"] = process.argv.slice(2);
const BASE = process.env.BASE ?? "https://lifeline-giving.vercel.app";
const b = await chromium.launch({ executablePath: process.env.HOME + "/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
async function check(name) {
  const r = await p.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll("body *")].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > w + 1 && getComputedStyle(e).position !== "fixed"; }).slice(0, 4).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 50)} right=${Math.round(e.getBoundingClientRect().right)}`);
    return { sw: document.documentElement.scrollWidth, w, wide };
  });
  console.log(`${name}: scrollWidth ${r.sw} / ${r.w}${r.sw > r.w ? " OVERFLOW " + JSON.stringify(r.wide) : ""}`);
}
for (const [name, path] of [["landing", "/"], ["dashboard", "/dashboard"], ["reports", "/reports"], ["rescues", "/rescues"], ["donors", "/donors"], ["activity", "/activity"]]) {
  await p.goto(BASE + path, { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  if (name === "landing") { for (let y = 0; y < 8000; y += 500) { await p.mouse.wheel(0, 500); await p.waitForTimeout(150); } await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500); }
  await check(name);
  await p.screenshot({ path: `${out}/${tag}-${name}.png`, fullPage: true });
}
// Landing: numbers count as they arrive; each rescue card animates when it reaches the screen.
await p.goto(BASE + "/", { waitUntil: "networkidle" });
await p.locator("#how").scrollIntoViewIfNeeded();
await p.mouse.wheel(0, 250);
await p.waitForTimeout(300);
const cardOpacity = () => p.evaluate(() => [...document.querySelectorAll("#how .rounded-2xl")].map((e) => Number(getComputedStyle(e).opacity).toFixed(1)).join(","));
console.log("rescue cards on arrival:", await cardOpacity());
await p.screenshot({ path: `${out}/${tag}-how-1.png` });
for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, 420); await p.waitForTimeout(i === 1 ? 250 : 900); if (i === 1) { console.log("rescue cards mid-scroll:", await cardOpacity()); await p.screenshot({ path: `${out}/${tag}-how-mid.png` }); } }
console.log("rescue cards after scrolling:", await cardOpacity());
await p.screenshot({ path: `${out}/${tag}-how-2.png` });
await p.goto(BASE + "/", { waitUntil: "networkidle" });
await p.waitForTimeout(800);
await p.evaluate(() => document.getElementById("why").scrollIntoView({ block: "start" }));
await p.waitForTimeout(60);
const nums = () => p.evaluate(() => [...document.querySelectorAll("[aria-labelledby=why] p[aria-label]")].map((e) => e.textContent).join(" | "));
console.log("why numbers at first:", await nums());
await p.waitForTimeout(250);
console.log("why numbers counting:", await nums());
for (let i = 0; i < 3; i++) { await p.mouse.wheel(0, 300); await p.waitForTimeout(700); }
console.log("why numbers after:", await nums());
await p.screenshot({ path: `${out}/${tag}-why.png` });
// Reports: Lifeline AI opens from the header and closes back to the report.
await p.goto(BASE + "/reports", { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/${tag}-reports-top.png` });
const askBtn = p.getByRole("button", { name: "Ask Lifeline AI" });
console.log("ask button:", await askBtn.count());
if (await askBtn.count()) {
  await askBtn.click(); await p.waitForTimeout(1500); await check("reports+ai"); await p.screenshot({ path: `${out}/${tag}-ask.png` });
  await p.getByRole("button", { name: "Back to the report" }).click(); await p.waitForTimeout(1000); await check("reports again"); await p.screenshot({ path: `${out}/${tag}-reports-back.png` });
}
console.log(errs.length ? "PAGE ERRORS " + errs.slice(0, 3).join(" | ") : "no page errors");
await b.close();
