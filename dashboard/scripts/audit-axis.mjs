#!/usr/bin/env node
// Gaps between neighbouring x-axis labels under the Dashboard usage bars, for every period, on the
// mock's year-end week, a mid-month week whose labels are all six characters, and a six-month Total.
// Exits 1 when two visible labels sit closer than --spacing-s2, or, where the axis is laid on the
// bars' grid (phone widths, at most 760px), when a label's centre is more than half a bar from its
// bar's centre or a label reaches into the screen's frame.
//   node scripts/audit-axis.mjs http://localhost:5173 [width]
import process from "node:process";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:5173";
const width = Number(process.argv[3] ?? 1440);
const MOCKS = [
  ["2025-12-31", ""],
  ["2025-11-19", ""],
  ["2025-12-31", "&mock_months=6"],
].map(([day, extra]) => `mock=1&mock_seed=baseline&mock_today=${day}&mock_now=${day}T12:00:00Z${extra}`);
const PERIODS = ["day", "week", "month", "total"];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });
let failures = 0;
for (const [mock, period] of MOCKS.flatMap((mock) => PERIODS.map((period) => [mock, period]))) {
  if (period === PERIODS[0]) await page.goto(`${base}/?${mock}`, { waitUntil: "networkidle" });
  await page.click(`[data-vu1="segment"] [data-kit="segment"][data-value="${period}"]`);
  await page.waitForTimeout(400);
  const { floor, labels } = await page.evaluate((phone) => {
    const floor = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--spacing-s2"));
    const axis = document.querySelector('[data-vu1="axis"]');
    const screen = document.querySelector('[data-vu1="screen"]');
    const frame = screen.getBoundingClientRect();
    const [inLeft, inRight] = [frame.left + screen.clientLeft, frame.right - screen.clientLeft];
    const bars = [...document.querySelectorAll('[data-vu1="chart"] [data-kit="bar-graph-bar"]')].map((bar) => bar.getBoundingClientRect());
    const labels = [...axis.children]
      .map((el) => ({ text: el.textContent, box: el.getBoundingClientRect(), column: parseInt(el.style.getPropertyValue("--bar"), 10) }))
      .filter(({ box }) => box.width > 0)
      .map(({ text, box, column }) => {
        const bar = bars[column - 1];
        const off = phone && bar ? Math.abs((box.left + box.right) / 2 - (bar.left + bar.right) / 2) : null;
        return { text, left: box.left, right: box.right, off, misplaced: phone && (!bar || off > bar.width / 2 || box.left < inLeft || box.right > inRight) };
      });
    return { floor, labels };
  }, width <= 760);
  const gaps = labels.slice(1).map((label, i) => label.left - labels[i].right);
  const min = gaps.length ? Math.min(...gaps) : Infinity;
  const misplaced = labels.filter((l) => l.misplaced).map((l) => l.text);
  const worst = Math.max(0, ...labels.map((l) => l.off ?? 0));
  const ok = labels.length > 0 && min >= floor && !misplaced.length;
  if (!ok) failures += 1;
  console.log(`axis ${width}px ${mock.match(/today=([\d-]+)/)[1]}${mock.includes("months=") ? "/6mo" : ""} ${period}\t${ok ? "ok" : "FAIL"}\tmin gap ${min.toFixed(1)}px (floor ${floor}px)\tcentre off ${labels.some((l) => l.off != null) ? `${worst.toFixed(1)}px` : "n/a"}${misplaced.length ? ` off its bar or in the frame: ${misplaced.join(", ")}` : ""}\t${labels.map((l) => l.text).join(" | ")}`);
}
await browser.close();
process.exit(failures ? 1 : 0);
