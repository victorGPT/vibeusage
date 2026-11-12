const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const upgradePath = path.join(
  root,
  "dashboard",
  "src",
  "ui",
  "2049",
  "blocks",
  "UpgradeBanner.tsx",
);

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("upgrade alert ignores unknown dismiss when a version is available", () => {
  const src = read(upgradePath);
  assert.doesNotMatch(
    src,
    /hasVersion\s*&&\s*safeGetItem\(unknownDismissKey\)/,
    "expected UpgradeAlertModal to avoid suppressing new versions",
  );
});
