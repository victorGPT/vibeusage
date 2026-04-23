const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const {
  MANAGED_START,
  MANAGED_END,
  DEFAULT_EVENTS,
  buildKimiHookCommand,
  resolveKimiConfigDir,
  resolveKimiConfigPath,
  upsertKimiHook,
  removeKimiHook,
  isKimiHookConfigured,
  probeKimiHook,
} = require("../src/lib/kimi-config");

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-kimi-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

test("resolveKimiConfigDir honors KIMI_HOME and defaults to ~/.kimi", () => {
  assert.equal(
    resolveKimiConfigDir({ home: "/home/alice", env: {} }),
    "/home/alice/.kimi",
  );
  assert.equal(
    resolveKimiConfigDir({ home: "/home/alice", env: { KIMI_HOME: "/custom/kimi" } }),
    "/custom/kimi",
  );
});

test("buildKimiHookCommand produces a quoted node invocation", () => {
  const cmd = buildKimiHookCommand("/home/alice/.vibeusage/bin/notify.cjs");
  assert.match(cmd, /^\/usr\/bin\/env node /);
  assert.ok(cmd.endsWith(" --source=kimi"));
});

test("upsertKimiHook appends a managed block to an existing config.toml", async () => {
  await withTempDir(async (dir) => {
    const configPath = path.join(dir, "config.toml");
    const hookCommand = buildKimiHookCommand("/tmp/notify.cjs");
    await fs.writeFile(configPath, 'default_model = "kimi-k2"\n\n[services]\n', "utf8");

    const result = await upsertKimiHook({ configPath, hookCommand });
    assert.equal(result.changed, true);
    assert.ok(result.backupPath);

    const content = await fs.readFile(configPath, "utf8");
    assert.ok(content.includes(MANAGED_START));
    assert.ok(content.includes(MANAGED_END));
    for (const event of DEFAULT_EVENTS) {
      assert.ok(content.includes(`event = "${event}"`));
    }
    assert.ok(content.includes(hookCommand));
    assert.ok(content.includes('default_model = "kimi-k2"'));
  });
});

test("upsertKimiHook is idempotent", async () => {
  await withTempDir(async (dir) => {
    const configPath = path.join(dir, "config.toml");
    const hookCommand = buildKimiHookCommand("/tmp/notify.cjs");
    await fs.writeFile(configPath, "[services]\n", "utf8");

    const first = await upsertKimiHook({ configPath, hookCommand });
    assert.equal(first.changed, true);
    const after = await fs.readFile(configPath, "utf8");

    const second = await upsertKimiHook({ configPath, hookCommand });
    assert.equal(second.changed, false);
    const again = await fs.readFile(configPath, "utf8");
    assert.equal(again, after);
  });
});

test("upsertKimiHook replaces a drifted block rather than duplicating it", async () => {
  await withTempDir(async (dir) => {
    const configPath = path.join(dir, "config.toml");
    const oldCmd = "/usr/bin/env node /old/notify.cjs --source=kimi";
    const newCmd = "/usr/bin/env node /new/notify.cjs --source=kimi";
    const stale = [
      "[services]",
      "",
      MANAGED_START,
      "[[hooks]]",
      'event = "Stop"',
      `command = "${oldCmd}"`,
      "timeout = 30",
      "",
      MANAGED_END,
      "",
    ].join("\n");
    await fs.writeFile(configPath, stale, "utf8");

    const result = await upsertKimiHook({ configPath, hookCommand: newCmd });
    assert.equal(result.changed, true);
    const content = await fs.readFile(configPath, "utf8");
    assert.ok(content.includes(newCmd));
    assert.ok(!content.includes(oldCmd));
    assert.equal(content.indexOf(MANAGED_START), content.lastIndexOf(MANAGED_START));
  });
});

test("probeKimiHook reports configured only when block matches exactly", async () => {
  await withTempDir(async (dir) => {
    const configPath = path.join(dir, "config.toml");
    const hookCommand = buildKimiHookCommand("/tmp/notify.cjs");
    await fs.writeFile(configPath, "[services]\n", "utf8");

    let probe = await probeKimiHook({ configPath, hookCommand });
    assert.equal(probe.configured, false);
    assert.equal(probe.anyPresent, false);

    await upsertKimiHook({ configPath, hookCommand });
    probe = await probeKimiHook({ configPath, hookCommand });
    assert.equal(probe.configured, true);
    assert.equal(probe.anyPresent, true);

    const configuredShortcut = await isKimiHookConfigured({ configPath, hookCommand });
    assert.equal(configuredShortcut, true);

    const otherCmd = buildKimiHookCommand("/other/notify.cjs");
    probe = await probeKimiHook({ configPath, hookCommand: otherCmd });
    assert.equal(probe.configured, false);
    assert.equal(probe.drifted, true);
  });
});

test("removeKimiHook strips the managed block and preserves surrounding config", async () => {
  await withTempDir(async (dir) => {
    const configPath = path.join(dir, "config.toml");
    const hookCommand = buildKimiHookCommand("/tmp/notify.cjs");
    const original = 'default_model = "kimi-k2"\n\n[services]\n';
    await fs.writeFile(configPath, original, "utf8");

    await upsertKimiHook({ configPath, hookCommand });
    const withBlock = await fs.readFile(configPath, "utf8");
    assert.ok(withBlock.includes(MANAGED_START));

    const result = await removeKimiHook({ configPath });
    assert.equal(result.removed, true);
    const stripped = await fs.readFile(configPath, "utf8");
    assert.ok(!stripped.includes(MANAGED_START));
    assert.ok(stripped.includes('default_model = "kimi-k2"'));
    assert.ok(stripped.includes("[services]"));
  });
});

test("removeKimiHook is a no-op when no block is present", async () => {
  await withTempDir(async (dir) => {
    const configPath = path.join(dir, "config.toml");
    await fs.writeFile(configPath, "[services]\n", "utf8");
    const result = await removeKimiHook({ configPath });
    assert.equal(result.removed, false);
    assert.equal(result.skippedReason, "hook-missing");
  });
});

test("removeKimiHook reports config-missing when file absent", async () => {
  await withTempDir(async (dir) => {
    const configPath = path.join(dir, "missing.toml");
    const result = await removeKimiHook({ configPath });
    assert.equal(result.removed, false);
    assert.equal(result.skippedReason, "config-missing");
  });
});

test("resolveKimiConfigPath joins config.toml under the dir", () => {
  assert.equal(
    resolveKimiConfigPath({ configDir: "/home/alice/.kimi" }),
    "/home/alice/.kimi/config.toml",
  );
});
