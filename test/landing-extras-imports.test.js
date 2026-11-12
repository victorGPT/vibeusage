const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const pagesDir = path.join(__dirname, "../dashboard/src/pages");
const srcDir = path.join(__dirname, "../dashboard/src");

test("every LandingPage import resolves to a file", () => {
  const src = fs.readFileSync(path.join(pagesDir, "LandingPage.jsx"), "utf8");
  const specs = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).filter((s) => s.startsWith(".") || s.startsWith("#src/"));
  assert.ok(specs.length > 0);
  for (const spec of specs) {
    const file = spec.startsWith("#src/") ? path.join(srcDir, spec.slice(5)) : path.join(pagesDir, spec);
    const found = ["", ".js", ".jsx", ".ts", ".tsx"].some((ext) => fs.existsSync(file + ext));
    assert.ok(found, `import ${spec} resolves`);
  }
});
