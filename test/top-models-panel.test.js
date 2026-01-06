const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

test("TopModelsPanel pads to 3 rows with empty placeholders", () => {
  const src = fs.readFileSync(
    path.join(
      __dirname,
      "../dashboard/src/ui/matrix-a/components/TopModelsPanel.jsx"
    ),
    "utf8"
  );

  assert.ok(
    src.includes("Array.from({ length: 3"),
    "expected fixed length 3 rows"
  );
  assert.ok(src.includes("rows[index]"), "expected row index lookup");
  assert.ok(src.includes("empty: true"), "expected empty placeholder rows");
  assert.ok(src.includes('name: ""'), "expected blank name placeholder");
  assert.ok(src.includes('percent: ""'), "expected blank percent placeholder");
});
