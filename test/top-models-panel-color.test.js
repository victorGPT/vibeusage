const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

test("TopModelsPanel renders percent in primary matrix color", () => {
  const src = fs.readFileSync(
    path.join(
      __dirname,
      "../dashboard/src/ui/matrix-a/components/TopModelsPanel.jsx"
    ),
    "utf8"
  );

  assert.match(
    src,
    /<span\s+className="[^"]*text-matrix-primary[^"]*"\s*>\s*\{percent\}/,
    "expected percent to use primary matrix color"
  );
  assert.match(
    src,
    /<span\s+className="[^"]*text-matrix-primary[^"]*"\s*>\s*\{percentSymbol\}/,
    "expected percent symbol to use primary matrix color"
  );
});
