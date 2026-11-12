const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const containerPath = path.join(__dirname, "..", "dashboard", "src", "pages", "DashboardPage.jsx");
const viewPath = path.join(
  __dirname,
  "..",
  "dashboard",
  "src",
  "ui",
  "matrix-a",
  "views",
  "DashboardView.jsx",
);
const copyPath = path.join(__dirname, "..", "dashboard", "src", "content", "copy.csv");
const projectUsagePath = path.join(
  __dirname,
  "..",
  "dashboard",
  "src",
  "ui",
  "matrix-a",
  "components",
  "ProjectUsagePanel.jsx",
);
const installStatusPath = path.join(
  __dirname,
  "..",
  "dashboard",
  "src",
  "lib",
  "install-status.js",
);

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("DashboardPage places TrendMonitor above heatmap in left column", () => {
  const src = readFile(viewPath);
  const leftStart = src.indexOf("lg:col-span-4");
  const rightStart = src.indexOf("lg:col-span-8", leftStart + 1);
  assert.ok(leftStart !== -1, "expected left column markup");
  assert.ok(rightStart !== -1, "expected right column markup");

  const leftColumn = src.slice(leftStart, rightStart);
  const trendIndex = leftColumn.indexOf("<TrendMonitor");
  const heatmapIndex = leftColumn.indexOf("{activityHeatmapBlock}");
  assert.ok(trendIndex !== -1, "expected TrendMonitor in left column");
  assert.ok(heatmapIndex !== -1, "expected heatmap block in left column");
  assert.ok(trendIndex < heatmapIndex, "expected TrendMonitor above heatmap in left column");
});

test("DashboardPage places project usage panel above CORE_INDEX in right column", () => {
  const src = readFile(viewPath);
  const leftStart = src.indexOf("lg:col-span-4");
  const rightStart = src.indexOf("lg:col-span-8", leftStart + 1);
  assert.ok(leftStart !== -1, "expected left column markup");
  assert.ok(rightStart !== -1, "expected right column markup");

  const leftColumn = src.slice(leftStart, rightStart);
  assert.ok(
    !leftColumn.includes("{projectUsageBlock}"),
    "expected project usage panel moved out of left column",
  );

  const rightColumn = src.slice(rightStart);
  const projectIndex = rightColumn.indexOf("{projectUsageBlock}");
  const usagePanelIndex = rightColumn.indexOf("<UsagePanel");
  assert.ok(projectIndex !== -1, "expected project usage panel in right column");
  assert.ok(usagePanelIndex !== -1, "expected UsagePanel in right column");
  assert.ok(
    projectIndex < usagePanelIndex,
    "expected project usage panel above UsagePanel in right column",
  );
});

test("ProjectUsagePanel lays out cards in responsive grid", () => {
  const src = readFile(projectUsagePath);
  assert.ok(src.includes("grid-cols-1"), "expected project usage grid to start with one column");
  assert.ok(
    src.includes("md:grid-cols-2"),
    "expected project usage grid to use two columns on medium screens",
  );
  assert.ok(
    src.includes("lg:grid-cols-3"),
    "expected project usage grid to use three columns on large screens",
  );
});

test("ProjectUsagePanel uses icon for star label", () => {
  const src = readFile(projectUsagePath);
  assert.ok(src.includes("data-star-icon"), "expected project usage panel to render a star icon");
  assert.ok(
    src.includes('data-star-position="top-right"'),
    "expected project usage panel to place star in top-right corner",
  );
  assert.ok(
    src.includes("formatCompactNumber(starsRaw"),
    "expected project usage panel to compact star values",
  );
  assert.ok(src.includes("h-[1.3em]"), "expected star icon height to match caption line height");
  assert.ok(src.includes('data-owner-row="true"'), "expected star to align with owner row");
});

test("ProjectUsagePanel renders three info rows", () => {
  const src = readFile(projectUsagePath);
  const markers = [
    'data-card-line="identity"',
    'data-card-line="stars"',
    'data-card-line="tokens"',
  ];
  for (const marker of markers) {
    assert.ok(src.includes(marker), `expected project usage card to render ${marker}`);
  }
});

test("ProjectUsagePanel constrains identity text width", () => {
  const src = readFile(projectUsagePath);
  assert.ok(src.includes('data-card-field="owner"'), "expected owner field marker for truncation");
  assert.ok(src.includes('data-card-field="repo"'), "expected repo field marker for truncation");
  assert.ok(src.includes("truncate"), "expected truncated identity text");
  assert.ok(src.includes("max-w-"), "expected max width constraint for identity text");
});

test("DashboardPage wires install panel gating through helper", () => {
  const containerSrc = readFile(containerPath);
  const installStatusSrc = readFile(installStatusPath);
  assert.ok(containerSrc.includes("shouldShowInstallCard"), "expected install status helper usage");
  assert.ok(
    containerSrc.includes("has_active_device_token"),
    "expected snake_case install token field usage",
  );
  assert.ok(containerSrc.includes("hasActiveDeviceToken"), "expected camelCase fallback usage");
  assert.ok(
    containerSrc.includes("const shouldShowInstall = shouldShowInstallCard({"),
    "expected helper-based install gate assignment",
  );
  assert.ok(
    installStatusSrc.includes("publicMode || screenshotMode"),
    "expected helper to hide in public/screenshot mode",
  );
  assert.ok(
    installStatusSrc.includes("if (forceInstall) return true"),
    "expected helper to honor forceInstall",
  );
  assert.ok(installStatusSrc.includes("accessEnabled"), "expected helper to check accessEnabled");
  assert.ok(
    installStatusSrc.includes("!heatmapLoading"),
    "expected helper to check heatmapLoading",
  );
  assert.ok(installStatusSrc.includes("activeDays === 0"), "expected helper to gate on activeDays");
  assert.ok(
    installStatusSrc.includes("!hasActiveDeviceToken"),
    "expected helper to hide card for active device token",
  );
  assert.ok(
    containerSrc.includes('if (shouldShowInstall) return "install";'),
    "expected the install screen to use shouldShowInstall",
  );
});

test("DashboardPage removes heatmap range label", () => {
  const src = readFile(viewPath);
  assert.ok(!src.includes("dashboard.activity.range"), "expected heatmap range label removed");
});

test("copy registry removes unused install steps and range label", () => {
  const csv = readFile(copyPath);
  const removed = [
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
  const src = readFile(viewPath);
  assert.ok(!src.includes('className="min-h-[240px]"'), "expected TrendMonitor min height removed");
  assert.ok(
    src.includes('className="h-auto min-h-[280px]"'),
    "expected TrendMonitor to override h-full with h-auto",
  );
});

test("TrendMonitor root does not force full height", () => {
  const src = readFile(
    path.join(
      __dirname,
      "..",
      "dashboard",
      "src",
      "ui",
      "matrix-a",
      "components",
      "TrendMonitor.jsx",
    ),
  );
  const lines = src.split("\n");
  const rootLine = lines.find((line) => line.includes("className={`w-full"));
  assert.ok(rootLine, "expected TrendMonitor root className line");
  assert.ok(!rootLine.includes("h-full"), "expected TrendMonitor root to avoid h-full");
});

test("DashboardPage supports force_install preview", () => {
  const src = readFile(containerPath);
  assert.ok(src.includes("force_install"), "expected force_install query param support");
  assert.ok(
    src.includes("isProductionHost"),
    "expected force_install gated by production host check",
  );
  assert.ok(
    src.includes("forceInstall"),
    "expected forceInstall flag to influence install visibility",
  );
});
