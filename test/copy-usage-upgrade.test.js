const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const copyPath = path.join(root, "dashboard", "src", "content", "copy.csv");
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

function hasCopyKey(csv, key) {
  return csv.startsWith(`${key},`) || csv.includes(`\n${key},`);
}

test("dashboard copy registry covers fleet usage and upgrade alert text", () => {
  const csv = read(copyPath);
  const requiredKeys = [
    "dashboard.model_breakdown.usage_label",
    "dashboard.upgrade_alert.title",
    "dashboard.upgrade_alert.subtitle",
    "dashboard.upgrade_alert.subtitle_generic",
    "dashboard.upgrade_alert.copy",
    "dashboard.upgrade_alert.copied",
    "dashboard.upgrade_alert.ignore",
    "dashboard.upgrade_alert.sparkle",
    "dashboard.upgrade_alert.prompt",
    "dashboard.upgrade_alert.install_command",
  ];

  for (const key of requiredKeys) {
    assert.ok(hasCopyKey(csv, key), `expected copy registry to include ${key}`);
  }
});

test("upgrade alert component uses copy keys", () => {
  const upgradeSource = read(upgradePath);
  const requiredUpgradeKeys = [
    "dashboard.upgrade_alert.title",
    "dashboard.upgrade_alert.subtitle",
    "dashboard.upgrade_alert.subtitle_generic",
    "dashboard.upgrade_alert.ignore",
    "dashboard.upgrade_alert.prompt",
    "dashboard.upgrade_alert.install_command",
  ];
  for (const key of requiredUpgradeKeys) {
    assert.ok(
      upgradeSource.includes(`copy(\"${key}\"`),
      `expected UpgradeAlertModal to use copy key ${key}`,
    );
  }

  const bannedLiterals = [
    "System_Upgrade_Pending",
    "Protocol v",
    "[ COPY ]",
    "[ COPIED ]",
    "[ IGNORE_NOTICE ]",
    "✨",
  ];
  for (const literal of bannedLiterals) {
    assert.ok(
      !upgradeSource.includes(literal),
      `expected UpgradeAlertModal to remove hardcoded text: ${literal}`,
    );
  }
});
