const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-audit-all-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function runCli({ args, env }) {
  const bin = path.join(__dirname, "..", "bin", "tracker.js");
  return spawnSync(process.execPath, [bin, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

test("doctor --audit-tokens --source all --json lists every registered source", async () => {
  await withTempDir(async (dir) => {
    // Empty HOME so every source returns no-local-sessions. That is an
    // acceptable state (informational, not hard error), and exercises the
    // all-sources iteration deterministically.
    const res = runCli({
      args: ["doctor", "--audit-tokens", "--source", "all", "--json"],
      env: {
        HOME: dir,
        XDG_DATA_HOME: path.join(dir, "xdg"),
        VIBEUSAGE_HOME: path.join(dir, "vibe-home"),
        CODEX_HOME: path.join(dir, "codex-home"),
        CODE_HOME: path.join(dir, "code-home"),
        GEMINI_HOME: path.join(dir, "gemini-home"),
        KIMI_HOME: path.join(dir, "kimi-home"),
        OPENCODE_HOME: path.join(dir, "opencode-home"),
      },
    });

    assert.equal(res.status, 0, `expected exit 0, got ${res.status}. stderr=${res.stderr}`);
    const payload = JSON.parse(res.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.sources.length, 8);
    const ids = payload.sources.map((s) => s.source).sort();
    assert.deepEqual(
      ids,
      ["claude", "codex", "every-code", "gemini", "hermes", "kimi", "openclaw", "opencode"],
    );
    for (const entry of payload.sources) {
      assert.equal(entry.ok, false);
      assert.equal(entry.error, "no-local-sessions");
    }
  });
});

test("doctor --audit-tokens --source all human output renders a table with status column", async () => {
  await withTempDir(async (dir) => {
    const res = runCli({
      args: ["doctor", "--audit-tokens", "--source", "all"],
      env: {
        HOME: dir,
        XDG_DATA_HOME: path.join(dir, "xdg"),
        VIBEUSAGE_HOME: path.join(dir, "vibe-home"),
        CODEX_HOME: path.join(dir, "codex-home"),
        CODE_HOME: path.join(dir, "code-home"),
        GEMINI_HOME: path.join(dir, "gemini-home"),
        KIMI_HOME: path.join(dir, "kimi-home"),
        OPENCODE_HOME: path.join(dir, "opencode-home"),
      },
    });

    assert.equal(res.status, 0);
    const stdout = res.stdout;
    assert.match(stdout, /Token audit across all registered sources/);
    assert.match(stdout, /no local sessions/);
    for (const id of ["claude", "opencode", "codex", "every-code", "gemini", "kimi", "hermes", "openclaw"]) {
      assert.ok(stdout.includes(id), `expected stdout to mention source "${id}"`);
    }
    assert.match(stdout, /All sources within threshold/);
  });
});

test("--source all includes 'all' in the registered list shown on unknown source", async () => {
  await withTempDir(async (dir) => {
    const res = runCli({
      args: ["doctor", "--audit-tokens", "--source", "bogus"],
      env: { HOME: dir },
    });
    assert.equal(res.status, 2);
    assert.match(res.stderr, /Registered: all, claude/);
  });
});
