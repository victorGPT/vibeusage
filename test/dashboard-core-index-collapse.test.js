const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(rel) {
  return fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
}

test("copy registry includes core index collapse keys", () => {
  const csv = read("dashboard/src/content/copy.csv");
  assert.ok(csv.includes("dashboard.core_index.collapse_label"));
  assert.ok(csv.includes("dashboard.core_index.expand_label"));
  assert.ok(csv.includes("dashboard.core_index.collapse_aria"));
  assert.ok(csv.includes("dashboard.core_index.expand_aria"));
});

test("UsagePanel supports breakdown collapse toggle", () => {
  const src = read("dashboard/src/ui/matrix-a/components/UsagePanel.jsx");
  assert.ok(src.includes("breakdownCollapsed"));
  assert.ok(src.includes("onToggleBreakdown"));
  assert.ok(src.includes("collapseAriaLabel"));
  assert.ok(src.includes("expandAriaLabel"));
});
