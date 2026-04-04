const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");

const { resolveTrackerPaths } = require("../lib/tracker-paths");
const { createIntegrationContext, uninstallIntegrations } = require("../lib/integrations");

async function cmdUninstall(argv) {
  const opts = parseArgs(argv);
  const home = os.homedir();
  const { trackerDir, binDir } = await resolveTrackerPaths({ home });
  const notifyPath = path.join(binDir, "notify.cjs");
  const integrationContext = await createIntegrationContext({
    home,
    env: process.env,
    trackerPaths: { trackerDir, binDir, rootDir: path.dirname(trackerDir) },
    notifyPath,
  });
  const codexConfigExists = await isFile(integrationContext.codex.configPath);
  const codeConfigExists = await isFile(integrationContext.everyCode.configPath);
  const claudeConfigExists = await isFile(integrationContext.claude.settingsPath);
  const geminiConfigExists = await isDir(integrationContext.gemini.configDir);
  const opencodeConfigExists = await isDir(integrationContext.opencode.configDir);
  const integrationResults = await uninstallIntegrations(integrationContext);
  const resultByName = new Map(integrationResults.map((result) => [result.name, result]));

  // Remove installed notify handler.
  await fs.unlink(notifyPath).catch(() => {});

  // Remove local app runtime (installed by init for notify-driven sync).
  await fs.rm(path.join(trackerDir, "app"), { recursive: true, force: true }).catch(() => {});

  if (opts.purge) {
    await fs.rm(path.join(home, ".vibeusage"), { recursive: true, force: true }).catch(() => {});
  }

  process.stdout.write(
    [
      "Uninstalled:",
      renderRestoreLine({
        exists: codexConfigExists,
        result: resultByName.get("codex"),
        missingText: "- Codex notify: skipped (config.toml not found)",
        restoredText: (result) =>
          `- Codex notify restored: ${result.detail || integrationContext.codex.configPath}`,
        noChangeText: "- Codex notify: no change",
        skippedText: "- Codex notify: skipped (no backup; not installed)",
      }),
      renderRestoreLine({
        exists: codeConfigExists,
        result: resultByName.get("every-code"),
        missingText: "- Every Code notify: skipped (config.toml not found)",
        restoredText: (result) =>
          `- Every Code notify restored: ${result.detail || integrationContext.everyCode.configPath}`,
        noChangeText: "- Every Code notify: no change",
        skippedText: "- Every Code notify: skipped (no backup; not installed)",
      }),
      renderHookLine({
        exists: claudeConfigExists,
        result: resultByName.get("claude"),
        missingText: "- Claude hooks: skipped (settings.json not found)",
        removedText: (result) =>
          `- Claude hooks removed: ${result.detail || integrationContext.claude.settingsPath}`,
        noChangeText: "- Claude hooks: no change",
        skippedText: "- Claude hooks: skipped",
      }),
      renderHookLine({
        exists: geminiConfigExists,
        result: resultByName.get("gemini"),
        missingText: `- Gemini hooks: skipped (${integrationContext.gemini.configDir} not found)`,
        removedText: (result) =>
          `- Gemini hooks removed: ${result.detail || integrationContext.gemini.settingsPath}`,
        noChangeText: "- Gemini hooks: no change",
        skippedText: "- Gemini hooks: skipped",
      }),
      renderHookLine({
        exists: opencodeConfigExists,
        result: resultByName.get("opencode"),
        missingText: `- Opencode plugin: skipped (${integrationContext.opencode.configDir} not found)`,
        removedText: (result) =>
          `- Opencode plugin removed: ${result.detail || integrationContext.opencode.configDir}`,
        noChangeText: "- Opencode plugin: no change",
        skippedText: "- Opencode plugin: skipped (unexpected content)",
      }),
      renderHookLine({
        exists: true,
        result: resultByName.get("openclaw-session"),
        missingText: "- OpenClaw session plugin: skipped (openclaw config not found)",
        removedText: (result) =>
          `- OpenClaw session plugin removed: ${result.detail || result.openclawConfigPath || "unknown"}`,
        noChangeText: "- OpenClaw session plugin: no change",
        skippedText: "- OpenClaw session plugin: no change",
        unreadableText: (result) =>
          `- OpenClaw session plugin: skipped (${result.detail || "openclaw config unreadable"})`,
      }),
      opts.purge ? `- Purged: ${path.join(home, ".vibeusage")}` : "- Purge: skipped (use --purge)",
      "",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const out = { purge: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--purge") out.purge = true;
    else throw new Error(`Unknown option: ${a}`);
  }
  return out;
}

module.exports = { cmdUninstall };

async function isFile(p) {
  try {
    const st = await fs.stat(p);
    return st.isFile();
  } catch (_e) {
    return false;
  }
}

function renderRestoreLine({ exists, result, missingText, restoredText, noChangeText, skippedText }) {
  if (!exists) return missingText;
  if (!result) return noChangeText;
  if (result.status === "restored" || result.status === "removed") {
    return restoredText(result);
  }
  if (result.skippedReason === "no-backup-not-installed") {
    return skippedText;
  }
  return noChangeText;
}

function renderHookLine({
  exists,
  result,
  missingText,
  removedText,
  noChangeText,
  skippedText,
  unreadableText = null,
}) {
  if (!exists) return missingText;
  if (!result) return noChangeText;
  if (result.status === "removed" || result.status === "updated") {
    return removedText(result);
  }
  if (result.skippedReason === "hook-missing") {
    return noChangeText;
  }
  if (result.skippedReason === "unexpected-content") {
    return skippedText;
  }
  if (result.skippedReason === "openclaw-config-missing") {
    return missingText;
  }
  if (result.skippedReason === "openclaw-config-unreadable") {
    return typeof unreadableText === "function"
      ? unreadableText(result)
      : unreadableText || skippedText;
  }
  return noChangeText;
}

async function isDir(p) {
  try {
    const st = await fs.stat(p);
    return st.isDirectory();
  } catch (_e) {
    return false;
  }
}
