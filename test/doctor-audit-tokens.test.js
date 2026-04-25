const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const { runAudit } = require("../src/lib/ops/audit-claude");

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-audit-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function assistantLine({ ts, messageId, input = 0, cc = 0, cr = 0, output = 0 }) {
  return JSON.stringify({
    timestamp: ts,
    type: "assistant",
    uuid: `u-${messageId}-${Math.random().toString(36).slice(2)}`,
    requestId: `req-${messageId}`,
    message: {
      id: messageId,
      role: "assistant",
      model: "claude-opus-4-7",
      usage: {
        input_tokens: input,
        cache_creation_input_tokens: cc,
        cache_read_input_tokens: cr,
        output_tokens: output,
      },
    },
  });
}

test("runAudit dedupes message.id and sums all four token channels", async () => {
  await withTempDir(async (dir) => {
    const projects = path.join(dir, "projects");
    const session = path.join(projects, "proj");
    await fs.mkdir(session, { recursive: true });
    const jsonl = path.join(session, "session.jsonl");

    // yesterday (UTC). runAudit default windows the last `days` days inclusive,
    // so any day inside the window is eligible.
    const now = new Date();
    const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const yIso = `${y.toISOString().slice(0, 10)}T10:00:00.000Z`;
    const day = yIso.slice(0, 10);

    const lines = [
      // msg_A counted once with i=10, cc=20, cr=30, out=5 -> total 65
      assistantLine({ ts: yIso, messageId: "msg_A", input: 10, cc: 20, cr: 30, output: 5 }),
      // duplicate of msg_A — should be skipped
      assistantLine({ ts: yIso, messageId: "msg_A", input: 10, cc: 20, cr: 30, output: 5 }),
      // msg_B counted once with i=1, cc=2, cr=3, out=4 -> total 10
      assistantLine({ ts: yIso, messageId: "msg_B", input: 1, cc: 2, cr: 3, output: 4 }),
    ];
    await fs.writeFile(jsonl, `${lines.join("\n")}\n`, "utf8");

    // DB JSON matching the expected truth -> drift 0%
    const dbJson = JSON.stringify([{ day, tokens: 75 }]);

    const res = runAudit({
      days: 3,
      threshold: 5,
      dbJson,
      projectsDir: projects,
    });

    assert.equal(res.ok, true);
    assert.equal(res.usageLines, 3, "three usage lines in the file");
    assert.equal(res.uniqueMessages, 2);
    assert.equal(res.duplicatesSkipped, 1);
    const row = res.rows.find((r) => r.day === day);
    assert.ok(row, "day row present");
    assert.equal(row.truth, 75); // 65 + 10
    assert.equal(row.db, 75);
    assert.equal(res.exceedsThreshold, false);
  });
});

test("runAudit flags drift when DB totals disagree with local ground truth", async () => {
  await withTempDir(async (dir) => {
    const projects = path.join(dir, "projects");
    const session = path.join(projects, "proj");
    await fs.mkdir(session, { recursive: true });
    const jsonl = path.join(session, "session.jsonl");

    const now = new Date();
    const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const yIso = `${y.toISOString().slice(0, 10)}T10:00:00.000Z`;
    const day = yIso.slice(0, 10);

    const line = assistantLine({ ts: yIso, messageId: "m1", input: 100, cr: 900, output: 10 });
    // truth = 1010; DB says 100 -> drift ~90% (what the April 2026 bug looked like)
    await fs.writeFile(jsonl, `${line}\n`, "utf8");
    const dbJson = JSON.stringify([{ day, tokens: 100 }]);

    const res = runAudit({
      days: 3,
      threshold: 10,
      dbJson,
      projectsDir: projects,
    });
    assert.equal(res.ok, true);
    assert.equal(res.exceedsThreshold, true);
    assert.ok(res.maxDriftPct > 80, `expected >80% drift, got ${res.maxDriftPct}`);
  });
});

test("runAudit includes subagent jsonl files nested under <session>/subagents/", async () => {
  await withTempDir(async (dir) => {
    const projects = path.join(dir, "projects");
    const sessionDir = path.join(projects, "proj", "sess-1", "subagents");
    await fs.mkdir(sessionDir, { recursive: true });
    const mainJsonl = path.join(projects, "proj", "session.jsonl");
    const subJsonl = path.join(sessionDir, "agent-abc.jsonl");

    const now = new Date();
    const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const yIso = `${y.toISOString().slice(0, 10)}T10:00:00.000Z`;
    const day = yIso.slice(0, 10);

    await fs.writeFile(
      mainJsonl,
      `${assistantLine({ ts: yIso, messageId: "main_1", input: 1, cr: 9, output: 0 })}\n`,
      "utf8",
    );
    await fs.writeFile(
      subJsonl,
      `${assistantLine({ ts: yIso, messageId: "sub_1", input: 100, cr: 900, output: 0 })}\n`,
      "utf8",
    );

    const dbJson = JSON.stringify([{ day, tokens: 1010 }]);
    const res = runAudit({ days: 3, threshold: 5, dbJson, projectsDir: projects });

    assert.equal(res.ok, true);
    assert.equal(res.uniqueMessages, 2, "main + subagent both counted");
    const row = res.rows.find((r) => r.day === day);
    assert.equal(row.truth, 1010, "subagent token included in truth");
    assert.equal(res.exceedsThreshold, false);
  });
});

test("runAudit returns an error shape when no sessions are available", async () => {
  await withTempDir(async (dir) => {
    const res = runAudit({
      days: 3,
      threshold: 25,
      dbJson: "[]",
      projectsDir: path.join(dir, "does-not-exist"),
    });
    assert.equal(res.ok, false);
    assert.equal(res.error, "no-local-sessions");
  });
});
