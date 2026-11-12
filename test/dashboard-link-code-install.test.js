const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const copyPath = path.join(__dirname, "..", "dashboard", "src", "content", "copy.csv");
const pagePath = path.join(__dirname, "..", "dashboard", "src", "pages", "DashboardPage.jsx");
const statePath = path.join(
  __dirname,
  "..",
  "dashboard",
  "src",
  "ui",
  "2049",
  "blocks",
  "StateScreen.tsx",
);

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("copy registry includes link code install keys", () => {
  const csv = readFile(copyPath);
  const required = [
    "dashboard.install.prompt",
    "dashboard.install.cmd.init_link_code",
    "dashboard.install.copy",
    "dashboard.install.copy_base",
    "dashboard.install.copied",
    "dashboard.install.link_code.loading",
    "dashboard.install.link_code.failed",
  ];
  for (const key of required) {
    assert.ok(csv.includes(key), `missing copy key: ${key}`);
  }
});

test("DashboardPage hands the unexpired link code to the install StateScreen", () => {
  const src = readFile(pagePath);
  const screenSrc = readFile(statePath);
  assert.match(src, /const resolvedLinkCode = !linkCodeExpired \? linkCode : null;/);
  assert.match(src, /if \(shouldShowInstall\) return "install";/);
  assert.match(src, /<StateScreen[\s\S]*?linkCode=\{resolvedLinkCode\}/);
  assert.ok(
    screenSrc.includes("dashboard.install.cmd.init_link_code"),
    "expected link code install command for the CommandBox",
  );
  assert.match(screenSrc, /<CommandBox/);
});
