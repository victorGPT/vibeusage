const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("DashboardPage declares timeZone before use in range computation", () => {
  const filePath = path.join(__dirname, "..", "dashboard", "src", "pages", "DashboardPage.jsx");
  const src = fs.readFileSync(filePath, "utf8");
  const timeZoneDeclIndex = src.search(/\b(const|let)\s+timeZone\b/);
  const rangeUseIndex = src.indexOf("getRangeForPeriod(");

  assert.ok(timeZoneDeclIndex !== -1, "timeZone declaration not found");
  assert.ok(rangeUseIndex !== -1, "getRangeForPeriod usage not found");
  assert.ok(
    timeZoneDeclIndex < rangeUseIndex,
    "timeZone should be declared before getRangeForPeriod call",
  );
});

test("DashboardPage declares mockEnabled before link code effect uses it", () => {
  const filePath = path.join(__dirname, "..", "dashboard", "src", "pages", "DashboardPage.jsx");
  const src = fs.readFileSync(filePath, "utf8");
  const mockEnabledDeclIndex = src.search(/\bconst\s+mockEnabled\b/);
  const effectUseIndex = src.indexOf("if (!signedIn || mockEnabled)");

  assert.ok(mockEnabledDeclIndex !== -1, "mockEnabled declaration not found");
  assert.ok(effectUseIndex !== -1, "mockEnabled usage in effect not found");
  assert.ok(
    mockEnabledDeclIndex < effectUseIndex,
    "mockEnabled should be declared before useEffect references it",
  );
});

function readPage() {
  return fs.readFileSync(
    path.join(__dirname, "..", "dashboard", "src", "pages", "DashboardPage.jsx"),
    "utf8",
  );
}

function loadMainScreen(src) {
  const start = src.indexOf("function mainScreen(");
  assert.ok(start !== -1, "mainScreen not found");
  const end = src.indexOf("\n}\n", start);
  return new Function(`${src.slice(start, end + 2)}; return mainScreen;`)();
}

test("DashboardPage renders the 2049 blocks in board order", () => {
  const src = readPage();
  const order = [
    "TopNav",
    "IdentityBar",
    "Readout",
    "RankRail",
    "Models",
    "DotHeatmap",
    "Trend",
    "Projects",
    "DailyTable",
    "PageFooter",
  ];
  let last = -1;
  for (const name of order) {
    const index = src.slice(last + 1).search(new RegExp(`<${name}\\b`));
    assert.ok(index !== -1, `expected <${name} after the previous block`);
    last += 1 + index;
  }
  assert.match(src, /<StateScreen\b/, "expected StateScreen in the main slot");
  assert.doesNotMatch(src, /<DashboardView\b/, "expected the matrix-a view to be gone");
});

test("mainScreen picks the first matching state in priority order", () => {
  const mainScreen = loadMainScreen(readPage());
  const base = {
    publicViewInvalid: false,
    showExpiredGate: false,
    usageError: null,
    shouldShowInstall: false,
    usageLoading: false,
    hasSummary: true,
    showEmpty: false,
  };
  const cases = [
    [{ publicViewInvalid: true, showExpiredGate: true, usageError: "x", publicMode: true }, "invalid"],
    [{ showExpiredGate: true, usageError: "x", shouldShowInstall: true }, "expired"],
    [{ usageError: "boom", shouldShowInstall: true, usageLoading: true }, "error"],
    [{ shouldShowInstall: true, usageLoading: true, hasSummary: false }, "install"],
    [{ usageLoading: true, hasSummary: false, showEmpty: true }, "loading"],
    [{ usageLoading: true, hasSummary: true }, "readout"],
    [{ showEmpty: true }, "empty"],
    [{ publicMode: true }, "readout"],
    [{}, "readout"],
  ];
  for (const [overrides, expected] of cases) {
    assert.equal(mainScreen({ ...base, ...overrides }), expected, JSON.stringify(overrides));
  }
});

test("screenshot mode gives the Readout no period handler, so it shows no tabs", () => {
  assert.match(readPage(), /onPeriodChange=\{screenshotMode \? undefined : transitionSelectedPeriod\}/);
});
