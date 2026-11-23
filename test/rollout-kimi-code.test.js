const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const { listKimiCodeSessionFiles, parseKimiIncremental } = require("../src/lib/rollout");

// Kimi Code CLI (MoonshotAI/kimi-code) wire shape:
//   ${KIMI_CODE_HOME:-~/.kimi-code}/sessions/<workDirKey>/<sessionId>/agents/<agentId>/wire.jsonl
// One `usage.record` per LLM request (the counted carrier, it has the model);
// the matching `step.end` loop event repeats the same usage and must not count again.

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-kimi-code-rollout-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

const T0 = Date.UTC(2026, 3, 1, 0, 10); // 2026-04-01T00:10:00.000Z in ms

function usageRecord({ time, usage, model = "kimi-k3", agentId = "main" }) {
  return JSON.stringify({ type: "usage.record", agentId, model, usage, usageScope: "turn", time });
}

function stepEnd({ time, usage, agentId = "main" }) {
  return JSON.stringify({
    type: "context.append_loop_event",
    agentId,
    event: { type: "step.end", uuid: "step-" + time, turnId: "0", step: 1, finishReason: "end_turn", usage },
    time,
  });
}

async function writeWire(sessionsDir, sessionId, agentId, lines) {
  const dir = path.join(sessionsDir, "wd_proj_abc123", sessionId, "agents", agentId);
  await fs.mkdir(dir, { recursive: true });
  const p = path.join(dir, "wire.jsonl");
  await fs.writeFile(p, lines.map((l) => l + "\n").join(""));
  return p;
}

async function readJsonLines(filePath) {
  const text = await fs.readFile(filePath, "utf8").catch(() => "");
  return text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

async function parse(dir, sessionsDir, cursors) {
  const queuePath = path.join(dir, "queue.jsonl");
  const res = await parseKimiIncremental({
    sessionFiles: await listKimiCodeSessionFiles(sessionsDir),
    cursors,
    queuePath,
    source: "kimi",
  });
  return { res, queued: await readJsonLines(queuePath) };
}

function lastRow(queued) {
  return queued[queued.length - 1];
}

test("listKimiCodeSessionFiles walks <workDirKey>/<sessionId>/agents/<agentId>/wire.jsonl", async () => {
  await withTempDir(async (dir) => {
    const sessionsDir = path.join(dir, "sessions");
    const main = await writeWire(sessionsDir, "session_a", "main", []);
    const sub = await writeWire(sessionsDir, "session_a", "sub_1", []);
    const files = await listKimiCodeSessionFiles(sessionsDir);
    assert.deepEqual(files, [main, sub].sort());
    assert.deepEqual(await listKimiCodeSessionFiles(path.join(dir, "missing")), []);
  });
});

test("kimi-code usage.record: channels and total are hand-checkable; step.end echo counts once", async () => {
  await withTempDir(async (dir) => {
    const sessionsDir = path.join(dir, "sessions");
    const usage = { inputOther: 100, output: 20, inputCacheRead: 50, inputCacheCreation: 10 };
    await writeWire(sessionsDir, "session_a", "main", [
      JSON.stringify({ type: "metadata", protocol_version: "1.5", created_at: T0 }),
      usageRecord({ time: T0, usage }),
      stepEnd({ time: T0, usage }),
    ]);
    const { res, queued } = await parse(dir, sessionsDir, { version: 1, files: {} });
    assert.equal(res.eventsAggregated, 1);
    const row = lastRow(queued);
    assert.equal(row.source, "kimi");
    assert.equal(row.model, "kimi-k3");
    assert.equal(row.hour_start, "2026-04-01T00:00:00.000Z");
    // input = inputOther + inputCacheCreation = 110; cached = 50; output = 20; total = 180
    assert.equal(row.input_tokens, 110);
    assert.equal(row.cached_input_tokens, 50);
    assert.equal(row.output_tokens, 20);
    assert.equal(row.reasoning_output_tokens, 0);
    assert.equal(row.total_tokens, 180);
  });
});

test("kimi-code large cache_read with tiny input/output keeps cache in total", async () => {
  await withTempDir(async (dir) => {
    const sessionsDir = path.join(dir, "sessions");
    await writeWire(sessionsDir, "session_a", "main", [
      usageRecord({ time: T0, usage: { inputOther: 3, output: 7, inputCacheRead: 90000, inputCacheCreation: 0 } }),
    ]);
    const { queued } = await parse(dir, sessionsDir, { version: 1, files: {} });
    const row = lastRow(queued);
    assert.equal(row.cached_input_tokens, 90000);
    assert.equal(row.total_tokens, 90010);
  });
});

test("kimi-code /fork copy of the same usage.record counts once (dedupe key)", async () => {
  await withTempDir(async (dir) => {
    const sessionsDir = path.join(dir, "sessions");
    const rec = usageRecord({ time: T0, usage: { inputOther: 100, output: 20, inputCacheRead: 0, inputCacheCreation: 0 } });
    await writeWire(sessionsDir, "session_a", "main", [rec]);
    // fork copies the parent's wire verbatim, then appends a `forked` marker
    await writeWire(sessionsDir, "session_b", "main", [rec, JSON.stringify({ type: "forked", agentId: "main", time: T0 + 5 })]);
    const cursors = { version: 1, files: {} };
    const { res, queued } = await parse(dir, sessionsDir, cursors);
    assert.equal(res.eventsAggregated, 1);
    assert.equal(lastRow(queued).total_tokens, 120);
    assert.equal(cursors.kimiSeen.length, 1);
  });
});

test("kimi-code cursor resume only counts appended lines; subagent wire counts too", async () => {
  await withTempDir(async (dir) => {
    const sessionsDir = path.join(dir, "sessions");
    const main = await writeWire(sessionsDir, "session_a", "main", [
      usageRecord({ time: T0, usage: { inputOther: 10, output: 5, inputCacheRead: 0, inputCacheCreation: 0 } }),
    ]);
    await writeWire(sessionsDir, "session_a", "sub_1", [
      usageRecord({ time: T0 + 1, agentId: "sub_1", usage: { inputOther: 1, output: 2, inputCacheRead: 3, inputCacheCreation: 4 } }),
    ]);
    const cursors = { version: 1, files: {} };
    const first = await parse(dir, sessionsDir, cursors);
    assert.equal(first.res.eventsAggregated, 2);
    assert.equal(lastRow(first.queued).total_tokens, 25); // 15 + 10

    await fs.appendFile(main, usageRecord({ time: T0 + 2, usage: { inputOther: 7, output: 3, inputCacheRead: 0, inputCacheCreation: 0 } }) + "\n");
    const second = await parse(dir, sessionsDir, cursors);
    assert.equal(second.res.eventsAggregated, 1);
    assert.equal(lastRow(second.queued).total_tokens, 35);
  });
});
