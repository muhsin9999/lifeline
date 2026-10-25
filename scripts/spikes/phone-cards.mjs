// Phone check for any app: page overflow, plus charts/tables/images that spill out of their card.
// BASE=https://... node scripts/spikes/phone-cards.mjs <out dir> <tag> /path1 /path2 ...
import { chromium } from "@playwright/test";
const [out, tag, ...paths] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.HOME + "/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
for (const path of paths) {
  await p.goto(process.env.BASE + path, { waitUntil: "networkidle" }).catch(() => {});
  await p.waitForTimeout(2000);
  const r = await p.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const boxed = (e) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (parseFloat(cs.borderLeftWidth) > 0 || parseFloat(cs.borderRadius) >= 8 || cs.overflowX !== "visible") return a; } return null; };
    const spills = [];
    for (const e of document.querySelectorAll("svg, canvas, img, table, pre, [role=tablist], .recharts-wrapper")) {
      const r = e.getBoundingClientRect();
      if (r.width < 40 || r.height < 20) continue;
      const box = boxed(e);
      if (!box) continue;
      const cs = getComputedStyle(box);
      if (cs.overflowX !== "visible") continue; // scrolls or clips on purpose
      const br = box.getBoundingClientRect();
      // The card's content area (inside its padding), and for an SVG whatever it actually draws, even outside its box.
      const inL = br.left + parseFloat(cs.paddingLeft), inR = br.right - parseFloat(cs.paddingRight);
      let right = r.right, left = r.left;
      if (e.tagName === "svg") for (const g of e.querySelectorAll("path, line, circle, text")) { const gr = g.getBoundingClientRect(); if (gr.width || gr.height) { right = Math.max(right, gr.right); left = Math.min(left, gr.left); } }
      if (right > inR + 2 || left < inL - 2) spills.push(`${e.tagName.toLowerCase()} ${Math.round(left)}–${Math.round(right)} in card ${Math.round(inL)}–${Math.round(inR)}`);
    }
    return { sw: document.documentElement.scrollWidth, w, spills: [...new Set(spills)].slice(0, 5) };
  });
  console.log(`${path}: ${r.sw > r.w ? `PAGE OVERFLOW ${r.sw}/${r.w}` : "fits"}${r.spills.length ? " · SPILLS " + JSON.stringify(r.spills) : ""}`);
  await p.screenshot({ path: `${out}/${tag}${path.replace(/\W+/g, "-") || "-home"}.png`, fullPage: true });
}
console.log(errs.length ? "PAGE ERRORS " + errs.slice(0, 3).join(" | ") : "no page errors");
await b.close();
