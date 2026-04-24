const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const { runSourceAudit, getStrategy } = require("../src/lib/ops/audit-source");

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-audit-codex-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function tokenCountEvent({ ts, last, total }) {
  return JSON.stringify({
    timestamp: ts,
    type: "event_msg",
    payload: {
      type: "token_count",
      info: { last_token_usage: last, total_token_usage: total },
    },
  });
}

function usage({ input = 0, cached = 0, output = 0, reasoning = 0, total }) {
  const tot = total != null ? total : input + output;
  return {
    input_tokens: input,
    cached_input_tokens: cached,
    output_tokens: output,
    reasoning_output_tokens: reasoning,
    total_tokens: tot,
  };
}

async function writeRollout(sessionsDir, dateParts, filename, lines) {
  const [y, m, d] = dateParts;
  const dir = path.join(sessionsDir, y, m, d);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), `${lines.join("\n")}\n`, "utf8");
}

test("audit-source registers codex and every-code strategies", () => {
  const c = getStrategy("codex");
  const e = getStrategy("every-code");
  assert.ok(c && c.id === "codex");
  assert.ok(e && e.id === "every-code");
  assert.equal(typeof c.walkSessions, "function");
  assert.equal(typeof c.iterateRecords, "function");
  assert.equal(typeof e.walkSessions, "function");
});

test("codex strategy sums upstream total_tokens and dedupes identical token_count pings", async () => {
  await withTempDir(async (dir) => {
    const codexHome = path.join(dir, ".codex");
    const sessionsDir = path.join(codexHome, "sessions");

    // Window-relevant day: yesterday UTC.
    const now = new Date();
    const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const dayIso = y.toISOString().slice(0, 10);
    const [yy, mm, dd] = dayIso.split("-");
    const baseTs = `${dayIso}T10:00:00.000Z`;
    const mkTs = (addSec) => new Date(y.getTime() + 10 * 3600 * 1000 + addSec * 1000).toISOString();

    // 1st event: first API call. total=100
    // 2nd event: dup (same total) — skipped.
    // 3rd event: second API call. total=120, last=20. Delta contributes 20.
    // 4th event: info:null (rate-limit ping) — skipped.
    const lines = [
      tokenCountEvent({
        ts: baseTs,
        last: usage({ input: 90, output: 10, total: 100 }),
        total: usage({ input: 90, output: 10, total: 100 }),
      }),
      tokenCountEvent({
        ts: mkTs(5),
        last: usage({ input: 90, output: 10, total: 100 }),
        total: usage({ input: 90, output: 10, total: 100 }),
      }),
      tokenCountEvent({
        ts: mkTs(60),
        last: usage({ input: 15, output: 5, total: 20 }),
        total: usage({ input: 105, output: 15, total: 120 }),
      }),
      JSON.stringify({
        timestamp: mkTs(90),
        type: "event_msg",
        payload: { type: "token_count", info: null },
      }),
    ];

    await writeRollout(sessionsDir, [yy, mm, dd], "rollout-test.jsonl", lines);

    // Truth = 100 (first call) + 20 (second call) = 120
    const dbJson = JSON.stringify([{ day: dayIso, tokens: 120 }]);

    const result = runSourceAudit({
      strategy: getStrategy("codex"),
      days: 3,
      threshold: 5,
      dbJson,
      home: dir,
      env: {},
    });

    assert.equal(result.ok, true);
    assert.equal(result.source, "codex");
    const row = result.rows.find((r) => r.day === dayIso);
    assert.ok(row, "day row present");
    assert.equal(row.truth, 120);
    assert.equal(row.db, 120);
    assert.equal(result.exceedsThreshold, false);
  });
});

test("every-code strategy reads ~/.code/sessions instead of ~/.codex/sessions", async () => {
  await withTempDir(async (dir) => {
    const sessionsDir = path.join(dir, ".code", "sessions");
    const now = new Date();
    const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const dayIso = y.toISOString().slice(0, 10);
    const [yy, mm, dd] = dayIso.split("-");
    const baseTs = `${dayIso}T08:00:00.000Z`;

    const lines = [
      tokenCountEvent({
        ts: baseTs,
        last: usage({ input: 50, output: 7, total: 57 }),
        total: usage({ input: 50, output: 7, total: 57 }),
      }),
    ];
    await writeRollout(sessionsDir, [yy, mm, dd], "rollout-ec.jsonl", lines);

    const dbJson = JSON.stringify([{ day: dayIso, tokens: 57 }]);
    const result = runSourceAudit({
      strategy: getStrategy("every-code"),
      days: 3,
      threshold: 5,
      dbJson,
      home: dir,
      env: {},
    });

    assert.equal(result.ok, true);
    assert.equal(result.source, "every-code");
    const row = result.rows.find((r) => r.day === dayIso);
    assert.ok(row);
    assert.equal(row.truth, 57);
    assert.equal(row.db, 57);
  });
});

test("codex strategy prunes YYYY/MM/DD directories older than the window", async () => {
  await withTempDir(async (dir) => {
    const sessionsDir = path.join(dir, ".codex", "sessions");
    // Stale day far outside the window (always > 14 days ago)
    await writeRollout(
      sessionsDir,
      ["2020", "01", "01"],
      "rollout-stale.jsonl",
      [
        tokenCountEvent({
          ts: "2020-01-01T00:00:00.000Z",
          last: usage({ input: 1, output: 1, total: 2 }),
          total: usage({ input: 1, output: 1, total: 2 }),
        }),
      ],
    );
    // Empty but eligible day (no rollout file)
    const now = new Date();
    const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const dayIso = y.toISOString().slice(0, 10);
    const [yy, mm, dd] = dayIso.split("-");
    const recentDir = path.join(sessionsDir, yy, mm, dd);
    await fs.mkdir(recentDir, { recursive: true });

    const strategy = getStrategy("codex");
    const root = strategy.sessionRoot({ home: dir, env: {} });
    const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 13));
    const files = strategy.walkSessions({ root, windowStartIso: windowStart.toISOString() });

    // Stale 2020 directory must not appear in the file list.
    assert.equal(files.length, 0, `expected 0 files, got ${JSON.stringify(files)}`);
  });
});
