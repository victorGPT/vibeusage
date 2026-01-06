const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

test("TrendMonitor root padding matches standard panel spacing", () => {
  const src = fs.readFileSync(
    path.join(
      __dirname,
      "../dashboard/src/ui/matrix-a/components/TrendMonitor.jsx"
    ),
    "utf8"
  );

  assert.ok(src.includes('from "./AsciiBox.jsx"'));
  assert.ok(src.includes("<AsciiBox"));
  assert.ok(!src.includes("ASCII_CHARS"));
});
