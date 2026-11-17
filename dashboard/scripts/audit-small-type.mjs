#!/usr/bin/env node
// Lists visible text set below --font-size-label (11px) on the given pages, the VU2-P2 type rule in
// DESIGN.md "Text levels". Exits 1 when it finds any, so a ticket that moves type onto the scale can
// rerun it as its check.
//   node scripts/audit-small-type.mjs http://localhost:5173 [width]
import process from "node:process";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:5173";
const width = Number(process.argv[3] ?? 1440);
const MOCK = "mock=1&mock_seed=baseline&mock_today=2025-12-31&mock_now=2025-12-31T12:00:00Z";
const PAGES = [
  ["landing", "/"],
  ["dashboard", `/?${MOCK}`],
  ["leaderboard", `/leaderboard?${MOCK}`],
];
const FLOOR = 11;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });
let found = 0;
for (const [name, path] of PAGES) {
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const hits = await page.evaluate((floor) => {
    const name = (el) => {
      const parts = [];
      for (let at = el; at && parts.length < 2; at = at.parentElement) {
        const key = at.getAttribute("data-vu1") ? `[data-vu1="${at.getAttribute("data-vu1")}"]` : at.getAttribute("data-kit") ? `[data-kit="${at.getAttribute("data-kit")}"]` : null;
        if (key) parts.unshift(key);
      }
      return `${parts.join(" ")} ${el.tagName.toLowerCase()}${el.hasAttribute("data-vu1-cap") ? "[data-vu1-cap]" : ""}`.trim();
    };
    const groups = new Map();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent.trim();
      const el = node.parentElement;
      if (!text || !el || el.closest(".sr-only")) continue;
      const style = getComputedStyle(el);
      const size = parseFloat(style.fontSize);
      const box = el.getBoundingClientRect();
      if (size >= floor || style.visibility === "hidden" || box.width === 0 || box.height === 0) continue;
      const key = `${size}px ${name(el)}`;
      const group = groups.get(key) ?? { key, count: 0, sample: text.slice(0, 24) };
      group.count += 1;
      groups.set(key, group);
    }
    return [...groups.values()];
  }, FLOOR);
  for (const hit of hits) console.log(`${name}\t${hit.key}\t${hit.count}\t${hit.sample}`);
  found += hits.length;
}
await browser.close();
console.log(`${found} groups of visible text below ${FLOOR}px at ${width}px`);
process.exit(found ? 1 : 0);
