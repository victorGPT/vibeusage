#!/usr/bin/env node
// Edge-line census for Leaderboard and Landing. For every block inside the device (its content, below
// the plate) and every top-level block of the page, prints its slot (the grid cell it is placed in) and
// its painted box, ring included. An edge counts as a line when the painted box reaches its slot there;
// an edge short of its slot (a content-width control, centred text) and the right edge of plain text,
// which is set ragged, are listed as free.
//   node scripts/audit-page-edges.mjs http://localhost:5173 [width]
import process from "node:process";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:5173";
const width = Number(process.argv[3] ?? 1440);
const MOCK = "mock=1&mock_seed=baseline&mock_today=2025-12-31&mock_now=2025-12-31T12:00:00Z";
const PAGES = [
  ["leaderboard", `/leaderboard?${MOCK}`],
  ["landing", "/"],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });
let report = "";
for (const [name, path] of PAGES) {
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const census = await page.evaluate(() => {
    const visible = (el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0" && r.width > 0 && r.height > 0 && !el.closest(".sr-only");
    };
    const kids = (el) => [...el.children].filter(visible);
    const ring = (s) => {
      let spread = 0;
      for (const part of s.boxShadow.split(/,(?![^(]*\))/)) {
        if (part.includes("inset")) continue;
        const px = part.replace(/rgba?\([^)]*\)|oklch\([^)]*\)|#[0-9a-f]+/gi, "").match(/-?[\d.]+px/g) ?? [];
        if (px.length >= 4 && parseFloat(px[0]) === 0 && parseFloat(px[1]) === 0 && parseFloat(px[2]) === 0) spread = Math.max(spread, parseFloat(px[3]));
      }
      return spread;
    };
    const paints = (s) => s.backgroundImage !== "none" || s.backgroundColor !== "rgba(0, 0, 0, 0)" || s.boxShadow !== "none";
    // The painted box: a block that paints is its own box plus its ring; a wrapper reports what it holds.
    const painted = (el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (paints(s) || el.matches("[data-kit]:not([data-kit=field])")) {
        const k = ring(s);
        return [r.left - k, r.right + k];
      }
      const inner = kids(el);
      if (!inner.length) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const t = range.getBoundingClientRect();
        return t.width ? [t.left, t.right] : [r.left, r.right];
      }
      const boxes = inner.map(painted);
      return [Math.min(...boxes.map((b) => b[0])), Math.max(...boxes.map((b) => b[1]))];
    };
    const tag = (el) => {
      for (const at of [el, ...el.querySelectorAll("*")]) {
        const key = at.getAttribute("data-vu1") || at.getAttribute("data-kit") || (at.hasAttribute("data-device") ? "device" : at.hasAttribute("data-device-plate") ? "plate" : null);
        if (key) return key;
      }
      return el.tagName.toLowerCase();
    };
    // A layout grid of several columns (grid-page, grid-device) is a row of slots; anything else is one block.
    const slots = (els) =>
      els.flatMap((el) => {
        const s = getComputedStyle(el);
        const columns = s.gridTemplateColumns.split(" ").length;
        if (!paints(s) && s.display === "grid" && columns > 1 && !el.matches("[data-vu1], [data-kit]")) return slots(kids(el));
        return [el];
      });
    const sides = (els) => {
      const rows = slots(els).map((el) => {
        const slot = el.getBoundingClientRect();
        const [l, r] = painted(el);
        const at = { block: tag(el), slot: [Math.round(slot.left), Math.round(slot.right)], painted: [Math.round(l), Math.round(r)] };
        // Text that paints nothing is set ragged-right: only its left edge is a line.
        const surface = [el, ...el.querySelectorAll("*")].some((x) => visible(x) && (paints(getComputedStyle(x)) || x.matches("[data-kit]:not([data-kit=field])")));
        at.freeLeft = at.painted[0] > at.slot[0] + 1;
        at.freeRight = !surface || at.painted[1] < at.slot[1] - 1;
        return at;
      });
      // Edges within 1px of each other are one line.
      const uniq = (xs) => [...new Set(xs)].sort((a, b) => a - b).filter((x, i, all) => i === 0 || x - all[i - 1] > 1);
      return {
        rows,
        lefts: uniq(rows.filter((r) => !r.freeLeft).map((r) => r.painted[0])),
        rights: uniq(rows.filter((r) => !r.freeRight).map((r) => r.painted[1])),
      };
    };
    const device = document.querySelector("[data-device]");
    const inside = kids(device).filter((el) => !el.hasAttribute("data-device-plate"));
    const shell = document.querySelector(".max-w-shell");
    const outside = kids(shell).flatMap((el) => (el.tagName === "MAIN" ? kids(el) : [el]));
    return { inside: sides(inside), outside: sides(outside) };
  });
  for (const where of ["inside", "outside"]) {
    const r = census[where];
    report += `${name} ${width} ${where}: ${r.lefts.length} left line(s) [${r.lefts}], ${r.rights.length} right line(s) [${r.rights}]\n`;
    for (const row of r.rows) {
      const free = [row.freeLeft && "left free", row.freeRight && "right free"].filter(Boolean).join(", ");
      report += `  ${row.block.padEnd(14)} slot ${row.slot.join("-").padEnd(10)} painted ${row.painted.join("-").padEnd(10)} ${free}\n`;
    }
  }
}
await browser.close();
process.stdout.write(report);
