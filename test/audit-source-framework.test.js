const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const {
  runSourceAudit,
  getStrategy,
  listRegisteredSources,
} = require("../src/lib/ops/audit-source");

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-audit-framework-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

test("getStrategy returns the claude strategy and null for unknown ids", () => {
  const claude = getStrategy("claude");
  assert.ok(claude && claude.id === "claude");
  assert.equal(typeof claude.sessionRoot, "function");
  assert.equal(typeof claude.walkSessions, "function");
  assert.equal(typeof claude.extractUsage, "function");

  assert.equal(getStrategy("does-not-exist"), null);
});

test("listRegisteredSources reports at least claude", () => {
  const ids = listRegisteredSources();
  assert.ok(Array.isArray(ids));
  assert.ok(ids.includes("claude"));
});

test("runSourceAudit accepts a synthetic strategy and honors its extractUsage shape", async () => {
  await withTempDir(async (dir) => {
    const file = path.join(dir, "fake.log");
    // Two unique events + 1 duplicate of the first
    await fs.writeFile(
      file,
      [
        JSON.stringify({ id: "A", ts: "2099-01-01T10:00:00Z", i: 10, cr: 90, o: 5 }),
        JSON.stringify({ id: "A", ts: "2099-01-01T10:00:02Z", i: 10, cr: 90, o: 5 }),
        JSON.stringify({ id: "B", ts: "2099-01-01T10:05:00Z", i: 1, cr: 2, o: 3 }),
        "",
      ].join("\n"),
      "utf8",
    );

    const strategy = {
      id: "fake",
      displayName: "Fake Source",
      sessionRoot() {
        return dir;
      },
      walkSessions({ root }) {
        return [path.join(root, "fake.log")];
      },
      extractUsage(line) {
        if (!line) return null;
        const obj = JSON.parse(line);
        return {
          timestamp: obj.ts,
          dedupeId: obj.id,
          channels: {
            input: obj.i,
            cache_creation: 0,
            cache_read: obj.cr,
            output: obj.o,
            reasoning: 0,
          },
        };
      },
    };

    // 2099-01-01 is inside a window of 365 days -> include it. Build a DB JSON
    // that matches the expected truth so drift is 0%.
    // Truth: A = 10+90+5 = 105; B = 1+2+3 = 6; total = 111.
    const dbJson = JSON.stringify([{ day: "2099-01-01", tokens: 111 }]);

    const res = runSourceAudit({
      strategy,
      days: Math.ceil(
        (new Date("2099-01-02") - new Date()) / (24 * 3600 * 1000),
      ),
      threshold: 5,
      dbJson,
    });

    assert.equal(res.ok, true);
    assert.equal(res.source, "fake");
    assert.equal(res.displayName, "Fake Source");
    assert.equal(res.uniqueMessages, 2, "dedupeId collapses to 2 unique ids");
    assert.equal(res.duplicatesSkipped, 1);
    const row = res.rows.find((r) => r.day === "2099-01-01");
    assert.ok(row, "day row present");
    assert.equal(row.truth, 111);
    assert.equal(row.db, 111);
    assert.equal(res.exceedsThreshold, false);
  });
});

test("runSourceAudit rejects when strategy is missing required callables", () => {
  assert.throws(() => runSourceAudit({}), /strategy/i);
  assert.throws(
    () =>
      runSourceAudit({
        strategy: { id: "x", sessionRoot: () => "/tmp" },
        dbJson: "[]",
      }),
    /walkSessions|extractUsage/,
  );
});

test("runSourceAudit returns no-local-sessions error when walkSessions yields nothing", async () => {
  await withTempDir(async (dir) => {
    const strategy = {
      id: "empty",
      sessionRoot: () => dir,
      walkSessions: () => [],
      extractUsage: () => null,
    };
    const res = runSourceAudit({ strategy, dbJson: "[]" });
    assert.equal(res.ok, false);
    assert.equal(res.error, "no-local-sessions");
    assert.equal(res.source, "empty");
  });
});
