const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

test("AsciiBox allows bodyClassName overrides for content padding", () => {
  const src = fs.readFileSync(
    path.join(
      __dirname,
      "../dashboard/src/ui/matrix-a/components/AsciiBox.jsx"
    ),
    "utf8"
  );

  assert.ok(src.includes("bodyClassName"));
  assert.ok(src.includes("${bodyClassName}"));
});
