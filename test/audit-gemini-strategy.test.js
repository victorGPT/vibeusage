const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const { runSourceAudit, getStrategy } = require("../src/lib/ops/audit-source");

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-audit-gemini-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function writeGeminiSession(geminiHome, hash, name, messages) {
  const dir = path.join(geminiHome, "tmp", hash, "chats");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), JSON.stringify({ messages }), "utf8");
}

test("audit-source registers the gemini strategy", () => {
  const s = getStrategy("gemini");
  assert.ok(s && s.id === "gemini");
  assert.equal(typeof s.sessionRoot, "function");
  assert.equal(typeof s.walkSessions, "function");
  assert.equal(typeof s.iterateRecords, "function");
});

test("gemini strategy sums per-call usage from .json and .jsonl sessions", async () => {
  await withTempDir(async (dir) => {
    const geminiHome = path.join(dir, ".gemini");

    const now = new Date();
    const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const yIso = y.toISOString().slice(0, 10);
    const ts = (addSec) => new Date(y.getTime() + 10 * 3600 * 1000 + addSec * 1000).toISOString();
    const gem = (id, addSec, total) => ({
      id,
      type: "gemini",
      timestamp: ts(addSec),
      tokens: { input: total - 1, output: 1, cached: 0, thoughts: 0, tool: 0, total },
    });

    // .json: user message skipped; each gemini message is its own call: 100 + 60
    await writeGeminiSession(geminiHome, "abc123", "session-2026-04-23T10-00-test.json", [
      { id: "u1", type: "user", timestamp: ts(0) },
      gem("g1", 10, 100),
      gem("g2", 30, 60),
    ]);
    // .jsonl: g3 rewritten (counted once), g4 rewound away: 40
    const dir2 = path.join(geminiHome, "tmp", "def456", "chats");
    await fs.mkdir(dir2, { recursive: true });
    const lines = [
      { sessionId: "s", projectHash: "p" },
      gem("g3", 40, 40),
      gem("g3", 40, 40),
      gem("g4", 50, 999),
      { $rewindTo: "g4" },
    ];
    await fs.writeFile(
      path.join(dir2, "session-2026-04-23T11-00-test.jsonl"),
      lines.map((l) => JSON.stringify(l)).join("\n") + "\n",
      "utf8",
    );

    const result = runSourceAudit({
      strategy: getStrategy("gemini"),
      days: 3,
      threshold: 5,
      dbJson: JSON.stringify([{ day: yIso, tokens: 200 }]),
      home: dir,
      env: { GEMINI_HOME: geminiHome },
    });

    assert.equal(result.ok, true);
    const row = result.rows.find((r) => r.day === yIso);
    assert.ok(row, "day row present");
    assert.equal(row.truth, 200, `expected 200, got ${row.truth}`);
    assert.equal(result.exceedsThreshold, false);
  });
});

test("gemini strategy reports no-local-sessions when tmp dir is missing", async () => {
  await withTempDir(async (dir) => {
    const result = runSourceAudit({
      strategy: getStrategy("gemini"),
      days: 3,
      threshold: 10,
      dbJson: "[]",
      home: dir,
      env: { GEMINI_HOME: path.join(dir, "no-such") },
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "no-local-sessions");
    assert.equal(result.source, "gemini");
  });
});
