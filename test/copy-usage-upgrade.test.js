const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const copyPath = path.join(root, "dashboard", "src", "content", "copy.csv");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function hasCopyKey(csv, key) {
  return csv.startsWith(`${key},`) || csv.includes(`\n${key},`);
}

test("dashboard copy registry covers the upgrade toast text", () => {
  const csv = read(copyPath);
  const requiredKeys = ["dashboard.upgrade_alert.install_command", "vu1.toast.available", "vu1.toast.update"];

  for (const key of requiredKeys) {
    assert.ok(hasCopyKey(csv, key), `expected copy registry to include ${key}`);
  }
});
