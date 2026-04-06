const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const { cmdStatus } = require("../src/commands/status");
const { ensureClaudePluginFiles } = require("../src/lib/claude-plugin");

test("status prints last upload timestamps from upload.throttle.json", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-status-"));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevWrite = process.stdout.write;

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, ".codex");

    const trackerDir = path.join(tmp, ".vibeusage", "tracker");
    await fs.mkdir(trackerDir, { recursive: true });
    await fs.mkdir(process.env.CODEX_HOME, { recursive: true });

    await fs.writeFile(
      path.join(process.env.CODEX_HOME, "config.toml"),
      'notify = [\"/usr/bin/env\", \"node\", \"~/.vibeusage/bin/notify.cjs\"]\n',
      "utf8",
    );

    await fs.writeFile(
      path.join(trackerDir, "config.json"),
      JSON.stringify(
        { baseUrl: "https://example.invalid", deviceToken: "t", deviceId: "d" },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    await fs.writeFile(
      path.join(trackerDir, "cursors.json"),
      JSON.stringify({ updatedAt: "2025-12-18T00:00:00.000Z" }) + "\n",
      "utf8",
    );
    await fs.writeFile(path.join(trackerDir, "queue.jsonl"), "", "utf8");
    await fs.writeFile(
      path.join(trackerDir, "queue.state.json"),
      JSON.stringify({ offset: 0 }) + "\n",
      "utf8",
    );
    await fs.writeFile(
      path.join(trackerDir, "openclaw.signal"),
      "2026-02-12T00:00:00.000Z\n",
      "utf8",
    );

    const lastSuccessMs = 1766053145522; // 2025-12-18T10:19:05.522Z
    const nextAllowedAtMs = lastSuccessMs + 1000;
    await fs.writeFile(
      path.join(trackerDir, "upload.throttle.json"),
      JSON.stringify(
        { version: 1, lastSuccessMs, nextAllowedAtMs, backoffUntilMs: 0, backoffStep: 0 },
        null,
        2,
      ) + "\n",
      "utf8",
    );

    let out = "";
    process.stdout.write = (chunk, enc, cb) => {
      out += typeof chunk === "string" ? chunk : chunk.toString(enc || "utf8");
      if (typeof cb === "function") cb();
      return true;
    };

    await cmdStatus();

    assert.match(out, /- Base URL: https:\/\/example\.invalid/);
    assert.match(out, /- Last upload: 2025-12-18T10:19:05\.522Z/);
    assert.match(out, /- Last OpenClaw-triggered sync: 2026-02-12T00:00:00.000Z/);
    assert.match(out, /- Next upload after: 2025-12-18T10:19:06\.522Z/);
  } finally {
    process.stdout.write = prevWrite;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("status does not migrate legacy tracker directory", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-status-legacy-"));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevWrite = process.stdout.write;

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, ".codex");

    const legacyTrackerDir = path.join(tmp, ".vibescore", "tracker");
    await fs.mkdir(legacyTrackerDir, { recursive: true });
    await fs.mkdir(process.env.CODEX_HOME, { recursive: true });

    await fs.writeFile(
      path.join(process.env.CODEX_HOME, "config.toml"),
      'notify = [\"/usr/bin/env\", \"node\", \"~/.vibescore/bin/notify.cjs\"]\n',
      "utf8",
    );

    await fs.writeFile(
      path.join(legacyTrackerDir, "config.json"),
      JSON.stringify(
        { baseUrl: "https://example.invalid", deviceToken: "t", deviceId: "d" },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    await fs.writeFile(
      path.join(legacyTrackerDir, "cursors.json"),
      JSON.stringify({ updatedAt: "2025-12-18T00:00:00.000Z" }) + "\n",
      "utf8",
    );
    await fs.writeFile(path.join(legacyTrackerDir, "queue.jsonl"), "", "utf8");
    await fs.writeFile(
      path.join(legacyTrackerDir, "queue.state.json"),
      JSON.stringify({ offset: 0 }) + "\n",
      "utf8",
    );

    const lastSuccessMs = 1766053145522; // 2025-12-18T10:19:05.522Z
    const nextAllowedAtMs = lastSuccessMs + 1000;
    await fs.writeFile(
      path.join(legacyTrackerDir, "upload.throttle.json"),
      JSON.stringify(
        { version: 1, lastSuccessMs, nextAllowedAtMs, backoffUntilMs: 0, backoffStep: 0 },
        null,
        2,
      ) + "\n",
      "utf8",
    );

    let out = "";
    process.stdout.write = (chunk, enc, cb) => {
      out += typeof chunk === "string" ? chunk : chunk.toString(enc || "utf8");
      if (typeof cb === "function") cb();
      return true;
    };

    await cmdStatus();

    assert.match(out, /- Base URL: unset/);
    assert.match(out, /- Last upload: never/);
    const newTrackerDir = path.join(tmp, ".vibeusage", "tracker");
    await assert.rejects(fs.stat(newTrackerDir));
    await fs.stat(legacyTrackerDir);
  } finally {
    process.stdout.write = prevWrite;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("status reports Claude plugin unsupported_legacy when only SessionEnd is configured", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-status-claude-"));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevWrite = process.stdout.write;

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, ".codex");

    const trackerDir = path.join(tmp, ".vibeusage", "tracker");
    const binDir = path.join(tmp, ".vibeusage", "bin");
    const claudeDir = path.join(tmp, ".claude");
    await fs.mkdir(trackerDir, { recursive: true });
    await fs.mkdir(binDir, { recursive: true });
    await fs.mkdir(claudeDir, { recursive: true });
    await fs.mkdir(process.env.CODEX_HOME, { recursive: true });

    const notifyPath = path.join(binDir, "notify.cjs");
    const hookCommand = `/usr/bin/env node "${notifyPath}" --source=claude`;
    await fs.writeFile(notifyPath, "// noop\n", "utf8");
    await fs.writeFile(
      path.join(claudeDir, "settings.json"),
      JSON.stringify(
        {
          hooks: {
            SessionEnd: [{ hooks: [{ type: "command", command: hookCommand }] }],
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );

    let out = "";
    process.stdout.write = (chunk, enc, cb) => {
      out += typeof chunk === "string" ? chunk : chunk.toString(enc || "utf8");
      if (typeof cb === "function") cb();
      return true;
    };

    await cmdStatus();

    assert.match(out, /- Claude plugin: unsupported_legacy/);
  } finally {
    process.stdout.write = prevWrite;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("status reports Claude plugin drifted when local plugin files exist without Claude registry state", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-status-claude-drifted-"));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevWrite = process.stdout.write;

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, ".codex");

    const trackerDir = path.join(tmp, ".vibeusage", "tracker");
    const notifyPath = path.join(tmp, ".vibeusage", "bin", "notify.cjs");
    const claudeDir = path.join(tmp, ".claude");
    await fs.mkdir(trackerDir, { recursive: true });
    await fs.mkdir(path.dirname(notifyPath), { recursive: true });
    await fs.mkdir(claudeDir, { recursive: true });
    await fs.mkdir(process.env.CODEX_HOME, { recursive: true });
    await fs.writeFile(notifyPath, "// noop\n", "utf8");

    await ensureClaudePluginFiles({
      trackerDir,
      notifyPath,
    });

    let out = "";
    process.stdout.write = (chunk, enc, cb) => {
      out += typeof chunk === "string" ? chunk : chunk.toString(enc || "utf8");
      if (typeof cb === "function") cb();
      return true;
    };

    await cmdStatus();

    assert.match(out, /- Claude plugin: drifted/);
  } finally {
    process.stdout.write = prevWrite;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("status shows only the supported OpenClaw integration when config cannot be parsed", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-status-openclaw-"));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevWrite = process.stdout.write;

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, ".codex");

    const trackerDir = path.join(tmp, ".vibeusage", "tracker");
    const openclawDir = path.join(tmp, ".openclaw");
    const openclawConfigPath = path.join(openclawDir, "openclaw.json");
    await fs.mkdir(trackerDir, { recursive: true });
    await fs.mkdir(openclawDir, { recursive: true });
    await fs.mkdir(process.env.CODEX_HOME, { recursive: true });
    await fs.writeFile(openclawConfigPath, "{ bad json\n", "utf8");

    let out = "";
    process.stdout.write = (chunk, enc, cb) => {
      out += typeof chunk === "string" ? chunk : chunk.toString(enc || "utf8");
      if (typeof cb === "function") cb();
      return true;
    };

    await cmdStatus();

    assert.match(out, /- OpenClaw session plugin: unreadable/);
    assert.doesNotMatch(out, /OpenClaw hook \(legacy\)/);
    assert.equal(await fs.readFile(openclawConfigPath, "utf8"), "{ bad json\n");
  } finally {
    process.stdout.write = prevWrite;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
test("status prints healthy opencode sqlite lines", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-status-opencode-ok-"));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevOpencodeHome = process.env.OPENCODE_HOME;
  const prevWrite = process.stdout.write;

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, ".codex");
    process.env.OPENCODE_HOME = path.join(tmp, ".opencode");

    const trackerDir = path.join(tmp, ".vibeusage", "tracker");
    await fs.mkdir(trackerDir, { recursive: true });
    await fs.mkdir(process.env.CODEX_HOME, { recursive: true });
    await fs.mkdir(process.env.OPENCODE_HOME, { recursive: true });
    await fs.writeFile(path.join(process.env.OPENCODE_HOME, "opencode.db"), "", "utf8");

    await fs.writeFile(
      path.join(process.env.CODEX_HOME, "config.toml"),
      'notify = ["/usr/bin/env", "node", "~/.vibeusage/bin/notify.cjs"]\n',
      "utf8",
    );
    await fs.writeFile(
      path.join(trackerDir, "cursors.json"),
      JSON.stringify({
        updatedAt: "2026-04-03T00:00:00.000Z",
        opencodeSqlite: {
          updatedAt: "2026-04-03T00:02:00.000Z",
          lastStatus: "ok",
          lastCheckedAt: "2026-04-03T00:03:00.000Z",
          lastErrorCode: null,
        },
      }) + "\n",
      "utf8",
    );

    let out = "";
    process.stdout.write = (chunk, enc, cb) => {
      out += typeof chunk === "string" ? chunk : chunk.toString(enc || "utf8");
      if (typeof cb === "function") cb();
      return true;
    };

    await cmdStatus();

    assert.match(out, /- OpenCode SQLite DB: present/);
    assert.match(out, /- OpenCode SQLite reader: ok/);
  } finally {
    process.stdout.write = prevWrite;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    if (prevOpencodeHome === undefined) delete process.env.OPENCODE_HOME;
    else process.env.OPENCODE_HOME = prevOpencodeHome;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("status prints degraded opencode sqlite lines", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-status-opencode-degraded-"));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevOpencodeHome = process.env.OPENCODE_HOME;
  const prevWrite = process.stdout.write;

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, ".codex");
    process.env.OPENCODE_HOME = path.join(tmp, ".opencode");

    const trackerDir = path.join(tmp, ".vibeusage", "tracker");
    await fs.mkdir(trackerDir, { recursive: true });
    await fs.mkdir(process.env.CODEX_HOME, { recursive: true });
    await fs.mkdir(process.env.OPENCODE_HOME, { recursive: true });
    await fs.writeFile(path.join(process.env.OPENCODE_HOME, "opencode.db"), "", "utf8");

    await fs.writeFile(
      path.join(process.env.CODEX_HOME, "config.toml"),
      'notify = ["/usr/bin/env", "node", "~/.vibeusage/bin/notify.cjs"]\n',
      "utf8",
    );
    await fs.writeFile(
      path.join(trackerDir, "cursors.json"),
      JSON.stringify({
        updatedAt: "2026-04-03T00:00:00.000Z",
        opencodeSqlite: {
          updatedAt: "2026-04-03T00:02:00.000Z",
          lastStatus: "missing-sqlite3",
          lastCheckedAt: "2026-04-03T00:03:00.000Z",
          lastErrorCode: "ENOENT",
        },
      }) + "\n",
      "utf8",
    );

    let out = "";
    process.stdout.write = (chunk, enc, cb) => {
      out += typeof chunk === "string" ? chunk : chunk.toString(enc || "utf8");
      if (typeof cb === "function") cb();
      return true;
    };

    await cmdStatus();

    assert.match(out, /- OpenCode SQLite DB: present/);
    assert.match(out, /- OpenCode SQLite reader: missing-sqlite3/);
  } finally {
    process.stdout.write = prevWrite;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    if (prevOpencodeHome === undefined) delete process.env.OPENCODE_HOME;
    else process.env.OPENCODE_HOME = prevOpencodeHome;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
