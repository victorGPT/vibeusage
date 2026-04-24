const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const { runSourceAudit, getStrategy } = require("../src/lib/ops/audit-source");

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-audit-kimi-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function writeWire(kimiHome, proj, session, lines) {
  const dir = path.join(kimiHome, "sessions", proj, session);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "wire.jsonl"), `${lines.join("\n")}\n`, "utf8");
}

function statusUpdate({ tsSec, messageId, inputOther = 0, cacheCreation = 0, cacheRead = 0, output = 0 }) {
  return JSON.stringify({
    timestamp: tsSec,
    message: {
      type: "StatusUpdate",
      payload: {
        message_id: messageId,
        token_usage: {
          input_other: inputOther,
          input_cache_creation: cacheCreation,
          input_cache_read: cacheRead,
          output,
        },
      },
    },
  });
}

test("audit-source registers the kimi strategy", () => {
  const s = getStrategy("kimi");
  assert.ok(s && s.id === "kimi");
  assert.equal(typeof s.sessionRoot, "function");
  assert.equal(typeof s.walkSessions, "function");
  assert.equal(typeof s.extractUsage, "function");
});

test("kimi strategy sums channels matching normalizeKimiUsage and dedupes by message_id", async () => {
  await withTempDir(async (dir) => {
    const kimiHome = path.join(dir, ".kimi");

    const now = new Date();
    const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const yIso = y.toISOString().slice(0, 10);
    const tsBase = Math.floor((y.getTime() + 10 * 3600 * 1000) / 1000);

    // msg_A: input_other 100 + cache_creation 20 + cache_read 500 + output 30 = 650
    //   (normalizeKimiUsage: input_tokens = 100+20 = 120, cached = 500, output = 30,
    //    total = 120 + 500 + 30 = 650)
    //   duplicate of msg_A -> skipped
    // msg_B: 10 + 0 + 5 + 2 = 17
    const lines = [
      statusUpdate({
        tsSec: tsBase,
        messageId: "chatcmpl-A",
        inputOther: 100,
        cacheCreation: 20,
        cacheRead: 500,
        output: 30,
      }),
      statusUpdate({
        tsSec: tsBase + 2,
        messageId: "chatcmpl-A", // dup
        inputOther: 100,
        cacheCreation: 20,
        cacheRead: 500,
        output: 30,
      }),
      statusUpdate({
        tsSec: tsBase + 10,
        messageId: "chatcmpl-B",
        inputOther: 10,
        cacheCreation: 0,
        cacheRead: 5,
        output: 2,
      }),
      // Non-StatusUpdate events are ignored.
      JSON.stringify({ timestamp: tsBase + 1, message: { type: "TurnBegin", payload: {} } }),
    ];

    await writeWire(kimiHome, "proj1", "ses1", lines);

    const dbJson = JSON.stringify([{ day: yIso, tokens: 650 + 17 }]);

    const result = runSourceAudit({
      strategy: getStrategy("kimi"),
      days: 3,
      threshold: 5,
      dbJson,
      home: dir,
      env: { KIMI_HOME: kimiHome },
    });

    assert.equal(result.ok, true);
    assert.equal(result.source, "kimi");
    assert.equal(result.uniqueMessages, 2);
    assert.equal(result.duplicatesSkipped, 1);
    const row = result.rows.find((r) => r.day === yIso);
    assert.ok(row);
    assert.equal(row.truth, 667);
    assert.equal(row.db, 667);
    assert.equal(result.exceedsThreshold, false);
  });
});

test("kimi strategy converts unix-second timestamps to ISO", async () => {
  await withTempDir(async (dir) => {
    const kimiHome = path.join(dir, ".kimi");
    // Use a fixed unix-seconds timestamp to verify conversion: 1767958695.463422 -> 2026-01-10T...
    // (we don't care about the exact date string; we care that the line is included
    //  when days is wide enough).
    const tsSec = 1767958695.463422;
    const expectedDay = new Date(tsSec * 1000).toISOString().slice(0, 10);
    const lines = [
      statusUpdate({
        tsSec,
        messageId: "m-1",
        inputOther: 1,
        cacheRead: 2,
        output: 3,
      }),
    ];
    await writeWire(kimiHome, "pp", "ss", lines);

    const now = new Date();
    const windowDays = Math.max(
      1,
      Math.ceil((now.getTime() - tsSec * 1000) / (24 * 3600 * 1000)) + 1,
    );
    const dbJson = JSON.stringify([{ day: expectedDay, tokens: 6 }]);

    const result = runSourceAudit({
      strategy: getStrategy("kimi"),
      days: windowDays,
      threshold: 5,
      dbJson,
      home: dir,
      env: { KIMI_HOME: kimiHome },
    });

    assert.equal(result.ok, true);
    const row = result.rows.find((r) => r.day === expectedDay);
    assert.ok(row, `row for ${expectedDay} present`);
    assert.equal(row.truth, 6);
  });
});

test("kimi strategy reports no-local-sessions when sessions dir missing", async () => {
  await withTempDir(async (dir) => {
    const result = runSourceAudit({
      strategy: getStrategy("kimi"),
      days: 3,
      threshold: 10,
      dbJson: "[]",
      home: dir,
      env: { KIMI_HOME: path.join(dir, "no-such") },
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "no-local-sessions");
    assert.equal(result.source, "kimi");
  });
});
