const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { upsertNotify } = require("../src/lib/codex-config");

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// Synthetic copy of the shape Codex Computer Use writes: our notify JSON-encoded
// (escaped quotes and slashes) inside a TOML string after --previous-notify.
const WRAPPED_LINE = String.raw`notify = ["/opt/wrapper/WrapClient", "turn-ended", "--previous-notify", "[\"\\/usr\\/bin\\/env\",\"node\",\"\\/home\\/u\\/.vibeusage\\/bin\\/notify.cjs\"]"]`;

test("upsertNotify treats a wrapped vibeusage notify as installed and leaves the file alone", async () => {
  const dir = tmpDir("vibeusage-codex-wrapped-");
  const configPath = path.join(dir, "config.toml");
  const notifyOriginalPath = path.join(dir, "codex_notify_original.json");
  const text = ['model = "m"', WRAPPED_LINE, "", "[features]", "x = true", ""].join("\n");
  fs.writeFileSync(configPath, text, "utf8");

  const result = await upsertNotify({
    configPath,
    notifyCmd: ["/usr/bin/env", "node", "/home/u/.vibeusage/bin/notify.cjs"],
    notifyOriginalPath,
    configLabel: "Codex config",
  });

  assert.deepEqual(result, { changed: false, backupPath: null });
  assert.equal(fs.readFileSync(configPath, "utf8"), text);
  assert.equal(fs.existsSync(notifyOriginalPath), false);
  assert.deepEqual(fs.readdirSync(dir), ["config.toml"]);
});

test("upsertNotify still installs and backs up when notify points elsewhere", async () => {
  const dir = tmpDir("vibeusage-codex-other-");
  const configPath = path.join(dir, "config.toml");
  const notifyOriginalPath = path.join(dir, "codex_notify_original.json");
  fs.writeFileSync(configPath, 'notify = ["/opt/other/hook.js"]\n', "utf8");

  const notifyCmd = ["/usr/bin/env", "node", "/home/u/.vibeusage/bin/notify.cjs"];
  const result = await upsertNotify({ configPath, notifyCmd, notifyOriginalPath });

  assert.equal(result.changed, true);
  assert.equal(fs.readFileSync(result.backupPath, "utf8"), 'notify = ["/opt/other/hook.js"]\n');
  assert.equal(
    fs.readFileSync(configPath, "utf8"),
    'notify = ["/usr/bin/env", "node", "/home/u/.vibeusage/bin/notify.cjs"]\n',
  );
  assert.deepEqual(JSON.parse(fs.readFileSync(notifyOriginalPath, "utf8")).notify, [
    "/opt/other/hook.js",
  ]);
});
