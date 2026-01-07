const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

test("NeuralAdaptiveFleet renders label in primary matrix color", () => {
  const src = fs.readFileSync(
    path.join(
      __dirname,
      "../dashboard/src/ui/matrix-a/components/NeuralAdaptiveFleet.jsx"
    ),
    "utf8"
  );

  assert.match(
    src,
    /<span\s+className="[^"]*text-matrix-primary[^"]*"\s*>\s*\{label\}/,
    "expected label to use primary matrix color"
  );
});
