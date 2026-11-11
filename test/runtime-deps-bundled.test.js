const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

// init copies only the package's own node_modules into ~/.vibeusage/tracker/app.
// Under npx, non-bundled deps are hoisted outside the package, so every runtime
// dependency must be bundled or the local runtime crashes with "Cannot find module".
test("every runtime dependency is bundled", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  const bundled = new Set(pkg.bundleDependencies || []);
  const missing = Object.keys(pkg.dependencies || {}).filter((d) => !bundled.has(d));
  assert.deepEqual(missing, []);
});
