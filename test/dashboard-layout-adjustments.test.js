const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const pagePath = path.join(
  __dirname,
  "..",
  "dashboard",
  "src",
  "pages",
  "DashboardPage.jsx"
);
const copyPath = path.join(
  __dirname,
  "..",
  "dashboard",
  "src",
  "content",
  "copy.csv"
);

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("DashboardPage places TrendMonitor above heatmap in left column", () => {
  const src = readFile(pagePath);
  const leftStart = src.indexOf("lg:col-span-4");
  const rightStart = src.indexOf("lg:col-span-8", leftStart + 1);
  assert.ok(leftStart !== -1, "expected left column markup");
  assert.ok(rightStart !== -1, "expected right column markup");

  const leftColumn = src.slice(leftStart, rightStart);
  const trendIndex = leftColumn.indexOf("<TrendMonitor");
  const heatmapIndex = leftColumn.indexOf("{activityHeatmapBlock}");
  assert.ok(trendIndex !== -1, "expected TrendMonitor in left column");
  assert.ok(heatmapIndex !== -1, "expected heatmap block in left column");
  assert.ok(
    trendIndex < heatmapIndex,
    "expected TrendMonitor above heatmap in left column"
  );
});

test("DashboardPage gates install panel by active days", () => {
  const src = readFile(pagePath);
  assert.ok(
    src.includes("const shouldShowInstall"),
    "expected shouldShowInstall gate"
  );
  assert.ok(
    src.includes("activeDays === 0"),
    "expected activeDays gate"
  );
  assert.ok(
    src.includes("accessEnabled"),
    "expected accessEnabled gate"
  );
  assert.ok(
    src.includes("heatmapLoading"),
    "expected heatmapLoading gate"
  );
  assert.ok(
    src.includes("shouldShowInstall ? ("),
    "expected install panel to use shouldShowInstall"
  );
});

test("DashboardPage removes heatmap range label", () => {
  const src = readFile(pagePath);
  assert.ok(
    !src.includes("dashboard.activity.range"),
    "expected heatmap range label removed"
  );
});

test("copy registry removes unused install steps and range label", () => {
  const csv = readFile(copyPath);
  const removed = [
    "landing.screenshot.alt",
    "dashboard.install.headline",
    "dashboard.install.step1",
    "dashboard.install.step2",
    "dashboard.install.step3",
    "dashboard.activity.range",
  ];
  for (const key of removed) {
    assert.ok(!csv.includes(key), `expected copy key removed: ${key}`);
  }
});

test("DashboardPage lets TrendMonitor auto-size", () => {
  const src = readFile(pagePath);
  assert.ok(
    !src.includes('className="min-h-[240px]"'),
    "expected TrendMonitor min height removed"
  );
  assert.ok(
    src.includes('className="h-auto min-h-[220px]"'),
    "expected TrendMonitor to override h-full with h-auto"
  );
});

test("DashboardPage supports force_install preview", () => {
  const src = readFile(pagePath);
  assert.ok(
    src.includes("force_install"),
    "expected force_install query param support"
  );
  assert.ok(
    src.includes("isProductionHost"),
    "expected force_install gated by production host check"
  );
  assert.ok(
    src.includes("forceInstall"),
    "expected forceInstall flag to influence install visibility"
  );
});
