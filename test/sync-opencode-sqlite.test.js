const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

test("sync passes opencode db path to parser even when message directory is empty", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-sync-opencode-sqlite-"));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevCodeHome = process.env.CODE_HOME;
  const prevGeminiHome = process.env.GEMINI_HOME;
  const prevOpencodeHome = process.env.OPENCODE_HOME;
  const rolloutPath = require.resolve("../src/lib/rollout");
  const syncPath = require.resolve("../src/commands/sync");

  delete require.cache[syncPath];
  const rollout = require(rolloutPath);
  const originals = {
    listRolloutFiles: rollout.listRolloutFiles,
    listClaudeProjectFiles: rollout.listClaudeProjectFiles,
    listGeminiSessionFiles: rollout.listGeminiSessionFiles,
    listOpencodeMessageFiles: rollout.listOpencodeMessageFiles,
    parseRolloutIncremental: rollout.parseRolloutIncremental,
    parseClaudeIncremental: rollout.parseClaudeIncremental,
    parseGeminiIncremental: rollout.parseGeminiIncremental,
    parseOpencodeIncremental: rollout.parseOpencodeIncremental,
    parseOpenclawIncremental: rollout.parseOpenclawIncremental,
  };

  let opencodeArgs = null;
  rollout.listRolloutFiles = async () => [];
  rollout.listClaudeProjectFiles = async () => [];
  rollout.listGeminiSessionFiles = async () => [];
  rollout.listOpencodeMessageFiles = async () => [];
  rollout.parseRolloutIncremental = async () => ({
    filesProcessed: 0,
    eventsAggregated: 0,
    bucketsQueued: 0,
  });
  rollout.parseClaudeIncremental = async () => ({
    filesProcessed: 0,
    eventsAggregated: 0,
    bucketsQueued: 0,
  });
  rollout.parseGeminiIncremental = async () => ({
    filesProcessed: 0,
    eventsAggregated: 0,
    bucketsQueued: 0,
  });
  rollout.parseOpenclawIncremental = async () => ({
    filesProcessed: 0,
    eventsAggregated: 0,
    bucketsQueued: 0,
  });
  rollout.parseOpencodeIncremental = async (args) => {
    opencodeArgs = args;
    return { filesProcessed: 0, eventsAggregated: 1, bucketsQueued: 1 };
  };

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, ".codex");
    process.env.CODE_HOME = path.join(tmp, ".code");
    process.env.GEMINI_HOME = path.join(tmp, ".gemini");
    process.env.OPENCODE_HOME = path.join(tmp, ".opencode");

    const { cmdSync } = require(syncPath);
    await cmdSync(["--auto"]);

    assert.ok(opencodeArgs, "expected sync to call parseOpencodeIncremental");
    assert.deepEqual(opencodeArgs.messageFiles, []);
    assert.equal(opencodeArgs.opencodeDbPath, path.join(tmp, ".opencode", "opencode.db"));
    assert.equal(opencodeArgs.source, "opencode");
  } finally {
    rollout.listRolloutFiles = originals.listRolloutFiles;
    rollout.listClaudeProjectFiles = originals.listClaudeProjectFiles;
    rollout.listGeminiSessionFiles = originals.listGeminiSessionFiles;
    rollout.listOpencodeMessageFiles = originals.listOpencodeMessageFiles;
    rollout.parseRolloutIncremental = originals.parseRolloutIncremental;
    rollout.parseClaudeIncremental = originals.parseClaudeIncremental;
    rollout.parseGeminiIncremental = originals.parseGeminiIncremental;
    rollout.parseOpencodeIncremental = originals.parseOpencodeIncremental;
    rollout.parseOpenclawIncremental = originals.parseOpenclawIncremental;
    delete require.cache[syncPath];

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
