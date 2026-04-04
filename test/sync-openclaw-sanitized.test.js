const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const { cmdSync } = require("../src/commands/sync");
const { buildOpenclawUsageEvent, appendOpenclawUsageEvent } = require("../src/lib/openclaw-usage-ledger");

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const raw = await fs.readFile(filePath, "utf8").catch(() => "");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function appendLedgerEvent({ trackerDir, emittedAt, model, inputTokens, outputTokens, totalTokens }) {
  const event = await buildOpenclawUsageEvent({
    trackerDir,
    payload: {
      emittedAt,
      source: "openclaw",
      agentId: "codex-dev",
      sessionKey: "agent:codex-dev:discord:channel:1490019049302659232",
      provider: "openai",
      model,
      channel: "discord",
      chatType: "channel",
      trigger: "llm_output",
      inputTokens,
      cachedInputTokens: 0,
      outputTokens,
      reasoningOutputTokens: 0,
      totalTokens,
    },
  });
  await appendOpenclawUsageEvent({ trackerDir, event });
}

test("sync --from-openclaw reads only the sanitized ledger and preserves openclaw totals", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-sync-openclaw-sanitized-"));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevCodeHome = process.env.CODE_HOME;
  const prevGeminiHome = process.env.GEMINI_HOME;
  const prevOpencodeHome = process.env.OPENCODE_HOME;

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, ".codex");
    process.env.CODE_HOME = path.join(tmp, ".code");
    process.env.GEMINI_HOME = path.join(tmp, ".gemini");
    process.env.OPENCODE_HOME = path.join(tmp, ".opencode");

    const trackerDir = path.join(tmp, ".vibeusage", "tracker");
    await fs.mkdir(trackerDir, { recursive: true });

    await appendLedgerEvent({
      trackerDir,
      emittedAt: "2026-04-05T01:10:00.000Z",
      model: "gpt-5.4",
      inputTokens: 100,
      outputTokens: 30,
      totalTokens: 130,
    });
    await appendLedgerEvent({
      trackerDir,
      emittedAt: "2026-04-05T01:20:00.000Z",
      model: "gpt-5.4",
      inputTokens: 50,
      outputTokens: 10,
      totalTokens: 60,
    });

    await cmdSync(["--from-openclaw"]);

    const queueRows = await readJsonl(path.join(trackerDir, "queue.jsonl"));
    const openclawRows = queueRows.filter((row) => row.source === "openclaw");
    assert.equal(openclawRows.length, 1);
    assert.equal(openclawRows[0].model, "gpt-5.4");
    assert.equal(openclawRows[0].hour_start, "2026-04-05T01:00:00.000Z");
    assert.equal(openclawRows[0].input_tokens, 150);
    assert.equal(openclawRows[0].output_tokens, 40);
    assert.equal(openclawRows[0].total_tokens, 190);

    const cursors = await readJson(path.join(trackerDir, "cursors.json"));
    assert.ok(Number(cursors?.openclawLedger?.offset || 0) > 0);
    assert.ok(!Object.keys(cursors.files || {}).some((key) => key.includes(".openclaw/agents/")));
  } finally {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    if (prevCodeHome === undefined) delete process.env.CODE_HOME;
    else process.env.CODE_HOME = prevCodeHome;
    if (prevGeminiHome === undefined) delete process.env.GEMINI_HOME;
    else process.env.GEMINI_HOME = prevGeminiHome;
    if (prevOpencodeHome === undefined) delete process.env.OPENCODE_HOME;
    else process.env.OPENCODE_HOME = prevOpencodeHome;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("sync --from-openclaw is idempotent across repeated trigger runs", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-sync-openclaw-sanitized-"));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevCodeHome = process.env.CODE_HOME;
  const prevGeminiHome = process.env.GEMINI_HOME;
  const prevOpencodeHome = process.env.OPENCODE_HOME;

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, ".codex");
    process.env.CODE_HOME = path.join(tmp, ".code");
    process.env.GEMINI_HOME = path.join(tmp, ".gemini");
    process.env.OPENCODE_HOME = path.join(tmp, ".opencode");

    const trackerDir = path.join(tmp, ".vibeusage", "tracker");
    await fs.mkdir(trackerDir, { recursive: true });

    await appendLedgerEvent({
      trackerDir,
      emittedAt: "2026-04-05T01:10:00.000Z",
      model: "gpt-5.4",
      inputTokens: 100,
      outputTokens: 30,
      totalTokens: 130,
    });

    await cmdSync(["--from-openclaw"]);
    const afterFirst = await readJsonl(path.join(trackerDir, "queue.jsonl"));

    await cmdSync(["--from-openclaw"]);
    const afterSecond = await readJsonl(path.join(trackerDir, "queue.jsonl"));

    assert.deepEqual(afterSecond, afterFirst);
  } finally {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    if (prevCodeHome === undefined) delete process.env.CODE_HOME;
    else process.env.CODE_HOME = prevCodeHome;
    if (prevGeminiHome === undefined) delete process.env.GEMINI_HOME;
    else process.env.GEMINI_HOME = prevGeminiHome;
    if (prevOpencodeHome === undefined) delete process.env.OPENCODE_HOME;
    else process.env.OPENCODE_HOME = prevOpencodeHome;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
