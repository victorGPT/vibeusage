const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

test("sync --auto queues pi session usage from PI_CODING_AGENT_DIR with source=pi", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-sync-pi-"));
  const keys = ["HOME", "CODEX_HOME", "CODE_HOME", "GEMINI_HOME", "KIMI_HOME", "OPENCODE_HOME", "PI_CODING_AGENT_DIR"];
  const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const syncPath = require.resolve("../src/commands/sync");
  delete require.cache[syncPath];
  try {
    process.env.HOME = tmp;
    for (const k of keys.slice(1)) process.env[k] = path.join(tmp, k.toLowerCase());
    const sessionDir = path.join(process.env.PI_CODING_AGENT_DIR, "sessions", "--tmp-proj--");
    await fs.mkdir(sessionDir, { recursive: true });
    const lines = [
      { type: "session", version: 3, id: "s1", timestamp: "2026-04-01T00:00:00.000Z", cwd: "/tmp/proj" },
      {
        type: "message",
        id: "a1",
        timestamp: "2026-04-01T00:05:00.000Z",
        message: { role: "assistant", model: "deepseek-v4", usage: { input: 10, output: 5, cacheRead: 100, cacheWrite: 0, reasoning: 0 } },
      },
    ];
    await fs.writeFile(
      path.join(sessionDir, "2026-04-01T00-00-00-000Z_s1.jsonl"),
      lines.map((l) => JSON.stringify(l)).join("\n") + "\n",
    );

    const { cmdSync } = require(syncPath);
    await cmdSync(["--auto"]);
    await cmdSync(["--auto"]);

    const queue = await fs.readFile(path.join(tmp, ".vibeusage", "tracker", "queue.jsonl"), "utf8");
    const rows = queue.split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.source === "pi");
    assert.equal(rows.length, 1, "second sync must not re-queue unchanged pi data");
    assert.equal(rows[0].model, "deepseek-v4");
    assert.equal(rows[0].total_tokens, 115);
  } finally {
    delete require.cache[syncPath];
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("sync and --rebuild expand ~ in PI_CODING_AGENT_DIR like pi does", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-sync-pi-tilde-"));
  const keys = ["HOME", "CODEX_HOME", "CODE_HOME", "GEMINI_HOME", "KIMI_HOME", "OPENCODE_HOME", "PI_CODING_AGENT_DIR"];
  const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const syncPath = require.resolve("../src/commands/sync");
  delete require.cache[syncPath];
  try {
    process.env.HOME = tmp;
    for (const k of keys.slice(1, -1)) process.env[k] = path.join(tmp, k.toLowerCase());
    process.env.PI_CODING_AGENT_DIR = "~/custom-pi";
    const sessionDir = path.join(tmp, "custom-pi", "sessions", "--p--");
    await fs.mkdir(sessionDir, { recursive: true });
    const lines = [
      { type: "session", version: 3, id: "s1", timestamp: "2026-04-01T00:00:00.000Z", cwd: "/nonexistent" },
      { type: "message", id: "a1", timestamp: "2026-04-01T00:05:00.000Z", message: { role: "assistant", model: "m", usage: { input: 1, output: 2 } } },
    ];
    await fs.writeFile(path.join(sessionDir, "s.jsonl"), lines.map((l) => JSON.stringify(l)).join("\n") + "\n");

    const { cmdSync } = require(syncPath);
    await cmdSync(["--auto"]);
    const trackerDir = path.join(tmp, ".vibeusage", "tracker");
    const queue = await fs.readFile(path.join(trackerDir, "queue.jsonl"), "utf8").catch(() => "");
    const rows = queue.split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.source === "pi");
    assert.equal(rows.length, 1);

    const { scrubSourceCursors } = require("../src/lib/cursor-scrub");
    const cursors = JSON.parse(await fs.readFile(path.join(trackerDir, "cursors.json"), "utf8"));
    const scrub = scrubSourceCursors({ cursors, sourceId: "pi", home: tmp, env: process.env });
    assert.equal(scrub.filesRemoved, 1);
    assert.equal(cursors.piSeen, undefined, "rebuild must also forget pi dedupe keys");
  } finally {
    delete require.cache[syncPath];
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
