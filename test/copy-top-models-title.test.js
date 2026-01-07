const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

test("copy registry uses spaced Top Models title", () => {
  const csvPath = path.join(
    __dirname,
    "../dashboard/src/content/copy.csv"
  );
  const csv = fs.readFileSync(csvPath, "utf8");
  const line = csv
    .split(/\r?\n/)
    .find((row) => row.startsWith("dashboard.top_models.title,"));

  assert.ok(line, "expected top models title entry");
  assert.ok(
    line.includes('"Top Models"'),
    "expected Top Models title to be spaced"
  );
});
