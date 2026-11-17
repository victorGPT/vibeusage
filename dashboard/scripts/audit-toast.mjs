#!/usr/bin/env node
// Checks that the upgrade toast covers nothing on the dashboard: at each scroll step it lists every visible
// element outside the toast whose box meets the toast's box. Exits 1 when a phone width (up to 760px) has
// any, or when the toast is missing. Wider widths keep the floating toast over the page and are printed only.
//   node scripts/audit-toast.mjs http://localhost:5173 [width]
import process from "node:process";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:5173";
const width = Number(process.argv[3] ?? 1440);
const PHONE = 760;
const MOCK = "mock=1&mock_seed=baseline&mock_today=2025-12-31&mock_now=2025-12-31T12:00:00Z";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });
await page.goto(`${base}/?${MOCK}`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const overlaps = () =>
  page.evaluate(() => {
    const toast = document.querySelector('[data-vu1="toast"]');
    if (!toast) return null;
    const t = toast.getBoundingClientRect();
    const hits = [];
    for (const el of document.body.querySelectorAll("*")) {
      if (toast.contains(el) || el.contains(toast)) continue;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (s.display === "none" || s.visibility === "hidden" || !r.width || !r.height || el.closest(".sr-only")) continue;
      if (r.right > t.left && r.left < t.right && r.bottom > t.top && r.top < t.bottom) {
        hits.push(`${el.getAttribute("data-vu1") || el.getAttribute("data-kit") || el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 24)}"`);
      }
    }
    return hits;
  });
const height = await page.evaluate(() => document.documentElement.scrollHeight);
const found = new Set();
let missing = false;
for (let y = 0; y <= height; y += 200) {
  await page.evaluate((top) => window.scrollTo(0, top), y);
  const hits = await overlaps();
  if (hits === null) missing = true;
  for (const hit of hits ?? []) found.add(hit);
}
await browser.close();
for (const hit of found) console.log(`dashboard\t${width}px\t${hit}`);
const gated = width <= PHONE;
console.log(missing ? `toast missing at ${width}px` : `${found.size} elements under the toast at ${width}px${gated ? "" : " (desktop, printed only)"}`);
process.exit(missing || (gated && found.size) ? 1 : 0);
