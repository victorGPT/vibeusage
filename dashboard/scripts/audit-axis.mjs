#!/usr/bin/env node
// Gaps between neighbouring x-axis labels under the Dashboard usage bars, for every period, on the
// mock's year-end week and on a mid-month week whose labels are all six characters. Exits 1
// when any two visible labels sit closer than --spacing-s2, so labels that touch or overlap fail.
//   node scripts/audit-axis.mjs http://localhost:5173 [width]
import process from "node:process";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:5173";
const width = Number(process.argv[3] ?? 1440);
const MOCKS = ["2025-12-31", "2025-11-19"].map((day) => `mock=1&mock_seed=baseline&mock_today=${day}&mock_now=${day}T12:00:00Z`);
const PERIODS = ["day", "week", "month", "total"];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });
let failures = 0;
for (const [mock, period] of MOCKS.flatMap((mock) => PERIODS.map((period) => [mock, period]))) {
  if (period === PERIODS[0]) await page.goto(`${base}/?${mock}`, { waitUntil: "networkidle" });
  await page.click(`[data-vu1="segment"] [data-kit="segment"][data-value="${period}"]`);
  await page.waitForTimeout(400);
  const { floor, labels } = await page.evaluate(() => {
    const floor = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--spacing-s2"));
    const spans = [...document.querySelectorAll('[data-vu1="axis"] > span')];
    const labels = spans
      .map((el) => ({ text: el.textContent, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0)
      .map(({ text, box }) => ({ text, left: box.left, right: box.right }));
    return { floor, labels };
  });
  const gaps = labels.slice(1).map((label, i) => label.left - labels[i].right);
  const min = gaps.length ? Math.min(...gaps) : Infinity;
  const ok = labels.length > 0 && min >= floor;
  if (!ok) failures += 1;
  console.log(`axis ${width}px ${mock.match(/today=([\d-]+)/)[1]} ${period}\t${ok ? "ok" : "FAIL"}\tmin gap ${min.toFixed(1)}px (floor ${floor}px)\t${labels.map((l) => l.text).join(" | ")}`);
}
await browser.close();
process.exit(failures ? 1 : 0);
