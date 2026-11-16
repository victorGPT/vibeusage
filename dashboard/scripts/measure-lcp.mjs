#!/usr/bin/env node
// Landing LCP under a slow link: 1.6 Mbps down, 750 kbps up, 150 ms latency, cache off.
// Usage: node scripts/measure-lcp.mjs <url> [runs=5]. Prints each run and the median in ms.
import { chromium } from "playwright";

const [url, runs = 5] = process.argv.slice(2);
if (!url) {
  console.error("usage: node scripts/measure-lcp.mjs <url> [runs]");
  process.exit(2);
}

const browser = await chromium.launch();
const results = [];
for (let i = 0; i < Number(runs); i++) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await page.route(/api\.github\.com/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stargazers_count: 57 }) }),
  );
  await page.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  results.push(Math.round(await page.evaluate(() => window.__lcp)));
  await context.close();
}
await browser.close();

const sorted = [...results].sort((a, b) => a - b);
console.log(JSON.stringify({ url, runs: results, median: sorted[Math.floor(sorted.length / 2)] }));
