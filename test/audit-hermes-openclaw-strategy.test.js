const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const { runSourceAudit, getStrategy, listRegisteredSources } = require("../src/lib/ops/audit-source");

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-audit-ledger-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function writeLedger(trackerDir, filename, lines) {
  await fs.mkdir(trackerDir, { recursive: true });
  await fs.writeFile(path.join(trackerDir, filename), `${lines.join("\n")}\n`, "utf8");
}

test("audit-source registers hermes and openclaw strategies", () => {
  const h = getStrategy("hermes");
  const o = getStrategy("openclaw");
  assert.ok(h && h.id === "hermes");
  assert.ok(o && o.id === "openclaw");
  const ids = listRegisteredSources();
  assert.ok(ids.includes("hermes"));
  assert.ok(ids.includes("openclaw"));
});

test("hermes strategy sums upstream total_tokens and ignores non-usage rows", async () => {
  await withTempDir(async (dir) => {
    const trackerDir = path.join(dir, ".vibeusage", "tracker");
    const now = new Date();
    const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const yIso = y.toISOString().slice(0, 10);
    const ts = (addSec) => new Date(y.getTime() + 10 * 3600 * 1000 + addSec * 1000).toISOString();

    const lines = [
      JSON.stringify({
        type: "usage",
        emitted_at: ts(0),
        model: "claude-opus-4-6",
        input_tokens: 10,
        output_tokens: 20,
        cache_read_tokens: 500,
        cache_write_tokens: 30,
        reasoning_tokens: 5,
        total_tokens: 565,
      }),
      JSON.stringify({ type: "handshake", emitted_at: ts(1) }), // ignored
      JSON.stringify({
        type: "usage",
        emitted_at: ts(20),
        model: "claude-opus-4-6",
        input_tokens: 5,
        output_tokens: 10,
        cache_read_tokens: 100,
        total_tokens: 115,
      }),
      JSON.stringify({
        type: "usage",
        emitted_at: ts(30),
        total_tokens: 0, // zero -> skipped
      }),
    ];
    await writeLedger(trackerDir, "hermes.usage.jsonl", lines);

    const dbJson = JSON.stringify([{ day: yIso, tokens: 565 + 115 }]);

    const strategy = getStrategy("hermes");
    const result = runSourceAudit({
      strategy,
      days: 3,
      threshold: 5,
      dbJson,
      home: dir,
      env: { VIBEUSAGE_HOME: path.join(dir, ".vibeusage") },
    });

    assert.equal(result.ok, true);
    assert.equal(result.source, "hermes");
    const row = result.rows.find((r) => r.day === yIso);
    assert.ok(row, "day row present");
    assert.equal(row.truth, 680);
    assert.equal(row.db, 680);
    assert.equal(result.exceedsThreshold, false);
  });
});

test("openclaw strategy sums totalTokens and dedupes by eventId", async () => {
  await withTempDir(async (dir) => {
    const trackerDir = path.join(dir, ".vibeusage", "tracker");
    const now = new Date();
    const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const yIso = y.toISOString().slice(0, 10);
    const ts = (addSec) => new Date(y.getTime() + 9 * 3600 * 1000 + addSec * 1000).toISOString();

    const lines = [
      JSON.stringify({
        eventId: "evt-1",
        emittedAt: ts(0),
        source: "openclaw",
        model: "gpt-5",
        inputTokens: 100,
        outputTokens: 50,
        cachedInputTokens: 0,
        reasoningOutputTokens: 10,
        totalTokens: 160,
      }),
      JSON.stringify({
        eventId: "evt-1", // duplicate -> skipped
        emittedAt: ts(5),
        source: "openclaw",
        model: "gpt-5",
        totalTokens: 160,
      }),
      JSON.stringify({
        eventId: "evt-2",
        emittedAt: ts(20),
        source: "openclaw",
        model: "gpt-5",
        totalTokens: 40,
      }),
    ];
    await writeLedger(trackerDir, "openclaw-usage-ledger.jsonl", lines);

    const dbJson = JSON.stringify([{ day: yIso, tokens: 200 }]);

    const strategy = getStrategy("openclaw");
    const result = runSourceAudit({
      strategy,
      days: 3,
      threshold: 5,
      dbJson,
      home: dir,
      env: { VIBEUSAGE_HOME: path.join(dir, ".vibeusage") },
    });

    assert.equal(result.ok, true);
    assert.equal(result.uniqueMessages, 2);
    assert.equal(result.duplicatesSkipped, 1);
    const row = result.rows.find((r) => r.day === yIso);
    assert.ok(row);
    assert.equal(row.truth, 200);
  });
});

test("hermes strategy reports no-local-sessions when ledger missing", async () => {
  await withTempDir(async (dir) => {
    const result = runSourceAudit({
      strategy: getStrategy("hermes"),
      days: 3,
      threshold: 5,
      dbJson: "[]",
      home: dir,
      env: { VIBEUSAGE_HOME: path.join(dir, "no-such") },
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "no-local-sessions");
  });
});

test("openclaw strategy reports no-local-sessions when ledger missing", async () => {
  await withTempDir(async (dir) => {
    const result = runSourceAudit({
      strategy: getStrategy("openclaw"),
      days: 3,
      threshold: 5,
      dbJson: "[]",
      home: dir,
      env: { VIBEUSAGE_HOME: path.join(dir, "no-such") },
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "no-local-sessions");
  });
});
