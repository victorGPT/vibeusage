#!/usr/bin/env node
// Edge census for the Dashboard device: the painted left and right x of every block in the device
// grid, and the distinct outer lines the rows start and end on. VU2 layout A declares 2 outer lines.
// Exits 1 when the count differs or a block paints past the grid.
//   node scripts/audit-edges.mjs http://localhost:5173 [width] [expected]
import process from "node:process";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:5173";
const width = Number(process.argv[3] ?? 1440);
const expected = Number(process.argv[4] ?? 2);
const MOCK = "mock=1&mock_seed=baseline&mock_today=2025-12-31&mock_now=2025-12-31T12:00:00Z";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });
await page.goto(`${base}/?${MOCK}`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const report = await page.evaluate(() => {
  const grid = document.querySelector("main .grid-device");
  const painted = (el) => {
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || el.closest(".sr-only")) return false;
    if (style.backgroundColor !== "rgba(0, 0, 0, 0)" || style.backgroundImage !== "none" || style.boxShadow !== "none") return true;
    if (parseFloat(style.borderLeftWidth) || parseFloat(style.borderTopWidth)) return true;
    return [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
  };
  // A bezel drawn as an outer box-shadow ring or an outline paints past the border box.
  const ring = (el) => {
    const style = getComputedStyle(el);
    let left = 0;
    let right = 0;
    for (const shadow of style.boxShadow === "none" ? [] : style.boxShadow.split(/,(?![^(]*\))/)) {
      if (/inset/.test(shadow)) continue;
      const [x = 0, , blur = 0, spread = 0] = (shadow.replace(/rgba?\([^)]*\)|#\w+|[a-z-]+\([^)]*\)/g, "").match(/-?[\d.]+px/g) ?? []).map(parseFloat);
      if (blur) continue;
      left = Math.max(left, spread - x);
      right = Math.max(right, spread + x);
    }
    const outline = style.outlineStyle === "none" ? 0 : parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
    return [Math.max(left, outline), Math.max(right, outline)];
  };
  const g = grid.getBoundingClientRect();
  const blocks = [...grid.children].map((cell) => {
    let left = Infinity;
    let right = -Infinity;
    for (const el of [cell, ...cell.querySelectorAll("*")]) {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height || !painted(el)) continue;
      const [out, outRight] = ring(el);
      left = Math.min(left, box.left - out);
      right = Math.max(right, box.right + outRight);
    }
    const name = cell.querySelector("[data-vu1], [data-kit]");
    const label = name?.getAttribute("data-vu1") ?? name?.getAttribute("data-kit") ?? cell.tagName.toLowerCase();
    return { block: label, top: Math.round(cell.getBoundingClientRect().top), left: Math.round(left), right: Math.round(right) };
  }).filter((b) => Number.isFinite(b.left));
  const rows = new Map();
  for (const b of blocks) rows.set(b.top, [...(rows.get(b.top) ?? []), b]);
  const outer = new Set();
  for (const row of rows.values()) {
    outer.add(Math.min(...row.map((b) => b.left)));
    outer.add(Math.max(...row.map((b) => b.right)));
  }
  return { grid: { left: Math.round(g.left), right: Math.round(g.right) }, blocks, outer: [...outer].sort((a, b) => a - b) };
});
await browser.close();
for (const b of report.blocks) console.log(`${b.block}\ttop ${b.top}\tleft ${b.left}\tright ${b.right}`);
const spill = report.blocks.filter((b) => b.left < report.grid.left || b.right > report.grid.right);
console.log(`grid ${report.grid.left}–${report.grid.right} at ${width}px`);
console.log(`outer lines: ${report.outer.length} (${report.outer.join(", ")}), expected ${expected}`);
for (const b of spill) console.log(`spill: ${b.block} ${b.left}–${b.right}`);
process.exit(report.outer.length === expected && !spill.length ? 0 : 1);
