const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("link code exchange uses records API (no rpc)", () => {
  const filePath = path.join(
    __dirname,
    "..",
    "insforge-src",
    "functions-esm",
    "vibeusage-link-code-exchange.js",
  );
  const src = fs.readFileSync(filePath, "utf8");
  assert.ok(src.includes("vibeusage_link_codes"), "expected link code table access");
  assert.ok(src.includes("vibeusage_tracker_devices"), "expected device table access");
  assert.ok(src.includes("vibeusage_tracker_device_tokens"), "expected token table access");
  assert.ok(!src.includes("/rpc/"), "expected rpc path to be removed");
});
