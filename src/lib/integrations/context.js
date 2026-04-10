const os = require("node:os");
const path = require("node:path");

const { buildClaudeHookCommand } = require("../claude-config");
const {
  resolveGeminiConfigDir,
  resolveGeminiSettingsPath,
  buildGeminiHookCommand,
} = require("../gemini-config");
const { resolveOpencodeConfigDir } = require("../opencode-config");
const { resolveOpenclawSessionPluginPaths } = require("../openclaw-session-plugin");
const { resolveHermesPluginPaths } = require("../hermes-config");
const { resolveTrackerPaths } = require("../tracker-paths");

async function createIntegrationContext({
  home = os.homedir(),
  env = process.env,
  trackerPaths = null,
  notifyPath = null,
} = {}) {
  const resolvedTrackerPaths = trackerPaths || (await resolveTrackerPaths({ home }));
  const resolvedNotifyPath = notifyPath || path.join(resolvedTrackerPaths.binDir, "notify.cjs");

  const codexHome = env.CODEX_HOME || path.join(home, ".codex");
  const codeHome = env.CODE_HOME || path.join(home, ".code");
  const claudeDir = path.join(home, ".claude");
  const geminiConfigDir = resolveGeminiConfigDir({ home, env });
  const opencodeConfigDir = resolveOpencodeConfigDir({ home, env });

  return {
    home,
    env,
    trackerPaths: resolvedTrackerPaths,
    notifyPath: resolvedNotifyPath,
    codex: {
      configPath: path.join(codexHome, "config.toml"),
      notifyCmd: ["/usr/bin/env", "node", resolvedNotifyPath],
      notifyOriginalPath: path.join(resolvedTrackerPaths.trackerDir, "codex_notify_original.json"),
    },
    everyCode: {
      configPath: path.join(codeHome, "config.toml"),
      notifyCmd: ["/usr/bin/env", "node", resolvedNotifyPath, "--source=every-code"],
      notifyOriginalPath: path.join(
        resolvedTrackerPaths.trackerDir,
        "code_notify_original.json",
      ),
    },
    claude: {
      configDir: claudeDir,
      settingsPath: path.join(claudeDir, "settings.json"),
      hookCommand: buildClaudeHookCommand(resolvedNotifyPath),
    },
    gemini: {
      configDir: geminiConfigDir,
      settingsPath: resolveGeminiSettingsPath({ configDir: geminiConfigDir }),
      hookCommand: buildGeminiHookCommand(resolvedNotifyPath),
    },
    opencode: {
      configDir: opencodeConfigDir,
    },
    hermes: resolveHermesPluginPaths({
      home,
      env,
      trackerDir: resolvedTrackerPaths.trackerDir,
    }),
    openclawSession: resolveOpenclawSessionPluginPaths({
      home,
      trackerDir: resolvedTrackerPaths.trackerDir,
      env,
    }),
  };
}

module.exports = {
  createIntegrationContext,
};
