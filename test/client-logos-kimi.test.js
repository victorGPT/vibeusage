const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const LOGOS_PATH = path.join(
  __dirname,
  "../dashboard/src/ui/matrix-a/components/ClientLogos.jsx",
);

test("ClientLogos registers a Kimi entry in CLIENTS", () => {
  const src = fs.readFileSync(LOGOS_PATH, "utf8");
  assert.match(
    src,
    /\{\s*id:\s*"kimi"\s*,\s*name:\s*"Kimi"\s*,\s*Icon:\s*KimiIcon\s*\}/,
    "expected CLIENTS to contain a kimi entry wired to KimiIcon",
  );
});

test("ClientLogos exports a KimiIcon component", () => {
  const src = fs.readFileSync(LOGOS_PATH, "utf8");
  assert.match(
    src,
    /export\s+function\s+KimiIcon\s*\(/,
    "expected a named KimiIcon export",
  );
  assert.match(src, /<svg[\s\S]*<\/svg>/, "KimiIcon must render an inline svg");
});

test("CLIENTS source ids stay kebab/lowercase to match backend source field", () => {
  const src = fs.readFileSync(LOGOS_PATH, "utf8");
  const ids = Array.from(src.matchAll(/\{\s*id:\s*"([^"]+)"/g)).map((m) => m[1]);
  assert.ok(ids.length >= 7, "should have at least 7 CLIENTS entries");
  for (const id of ids) {
    assert.match(id, /^[a-z][a-z0-9-]*$/, `id "${id}" should be lowercase kebab-case`);
  }
  assert.ok(ids.includes("kimi"), "expected kimi among CLIENTS ids");
  assert.ok(ids.includes("hermes"), "expected hermes among CLIENTS ids");
});

test("ClientLogos registers a Hermes entry in CLIENTS", () => {
  const src = fs.readFileSync(LOGOS_PATH, "utf8");
  assert.match(
    src,
    /\{\s*id:\s*"hermes"\s*,\s*name:\s*"Hermes"\s*,\s*Icon:\s*HermesIcon\s*\}/,
    "expected CLIENTS to contain a hermes entry wired to HermesIcon",
  );
  assert.match(src, /export\s+function\s+HermesIcon\s*\(/, "expected HermesIcon export");
});
