const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("DashboardPage declares timeZone before use in range computation", () => {
  const filePath = path.join(
    __dirname,
    "..",
    "dashboard",
    "src",
    "pages",
    "DashboardPage.jsx"
  );
  const src = fs.readFileSync(filePath, "utf8");
  const timeZoneDeclIndex = src.search(/\b(const|let)\s+timeZone\b/);
  const rangeUseIndex = src.indexOf("getRangeForPeriod(");

  assert.ok(timeZoneDeclIndex !== -1, "timeZone declaration not found");
  assert.ok(rangeUseIndex !== -1, "getRangeForPeriod usage not found");
  assert.ok(
    timeZoneDeclIndex < rangeUseIndex,
    "timeZone should be declared before getRangeForPeriod call"
  );
});

test("DashboardPage declares mockEnabled before link code effect uses it", () => {
  const filePath = path.join(
    __dirname,
    "..",
    "dashboard",
    "src",
    "pages",
    "DashboardPage.jsx"
  );
  const src = fs.readFileSync(filePath, "utf8");
  const mockEnabledDeclIndex = src.search(/\bconst\s+mockEnabled\b/);
  const effectUseIndex = src.indexOf("if (!signedIn || mockEnabled)");

  assert.ok(mockEnabledDeclIndex !== -1, "mockEnabled declaration not found");
  assert.ok(effectUseIndex !== -1, "mockEnabled usage in effect not found");
  assert.ok(
    mockEnabledDeclIndex < effectUseIndex,
    "mockEnabled should be declared before useEffect references it"
  );
});
