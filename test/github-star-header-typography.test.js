const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

test("GithubStar header typography matches header buttons", () => {
  const src = fs.readFileSync(
    path.join(
      __dirname,
      "../dashboard/src/ui/matrix-a/components/GithubStar.jsx"
    ),
    "utf8"
  );

  const headerMatch = src.match(/size === "header"\s*\?\s*"([^"]+)"/);
  assert.ok(headerMatch, "expected header base classes");
  const headerClasses = headerMatch[1];

  assert.ok(
    headerClasses.includes("text-caption"),
    "expected header typography to use text-caption"
  );
  assert.ok(
    headerClasses.includes("uppercase"),
    "expected header typography to use uppercase"
  );
  assert.ok(
    headerClasses.includes("font-bold"),
    "expected header typography to use font-bold"
  );
  assert.ok(
    headerClasses.includes("tracking-[0.2em]"),
    "expected header typography to use tracking-[0.2em]"
  );

  assert.match(
    src,
    /text-matrix-bright[^"]*tracking-normal/,
    "expected star count to reset tracking"
  );
});
