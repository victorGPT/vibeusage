const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const cp = require("node:child_process");

const { ensureDir, readJsonStrict, writeFileAtomic } = require("./fs");
const { buildClaudeHookCommand } = require("./claude-config");

const CLAUDE_PLUGIN_MARKETPLACE_NAME = "vibeusage-local";
const CLAUDE_PLUGIN_ID = "vibeusage-claude-sync";
const CLAUDE_PLUGIN_VERSION = "0.0.0";

function resolveClaudePluginPaths({ home = os.homedir(), trackerDir } = {}) {
  if (!trackerDir) throw new Error("trackerDir is required");

  const claudeDir = path.join(home, ".claude");
  const pluginsDir = path.join(claudeDir, "plugins");
  const marketplaceDir = path.join(trackerDir, "claude-marketplace");
  const pluginRootDir = path.join(marketplaceDir, "plugins", CLAUDE_PLUGIN_ID);
  const pluginRef = `${CLAUDE_PLUGIN_ID}@${CLAUDE_PLUGIN_MARKETPLACE_NAME}`;

  return {
    claudeDir,
    settingsPath: path.join(claudeDir, "settings.json"),
    pluginsDir,
    knownMarketplacesPath: path.join(pluginsDir, "known_marketplaces.json"),
    installedPluginsPath: path.join(pluginsDir, "installed_plugins.json"),
    marketplaceDir,
    marketplaceManifestPath: path.join(marketplaceDir, ".claude-plugin", "marketplace.json"),
    pluginRootDir,
    pluginManifestPath: path.join(pluginRootDir, ".claude-plugin", "plugin.json"),
    pluginHooksPath: path.join(pluginRootDir, "hooks", "hooks.json"),
    pluginRef,
  };
}

async function ensureClaudePluginFiles({ trackerDir, notifyPath } = {}) {
  if (!trackerDir || !notifyPath) {
    throw new Error("trackerDir and notifyPath are required");
  }

  const paths = resolveClaudePluginPaths({ trackerDir });

  await ensureDir(path.dirname(paths.marketplaceManifestPath));
  await ensureDir(path.dirname(paths.pluginManifestPath));
  await ensureDir(path.dirname(paths.pluginHooksPath));

  await writeFileAtomic(paths.marketplaceManifestPath, buildMarketplaceManifest());
  await writeFileAtomic(paths.pluginManifestPath, buildPluginManifest());
  await writeFileAtomic(paths.pluginHooksPath, buildPluginHooks({ notifyPath }));

  return paths;
}

async function probeClaudePluginState({ home = os.homedir(), trackerDir } = {}) {
  const paths = resolveClaudePluginPaths({ home, trackerDir });
  const settings = await readJsonStrict(paths.settingsPath);
  const known = await readJsonStrict(paths.knownMarketplacesPath);
  const installed = await readJsonStrict(paths.installedPluginsPath);
  const pluginFilesReady =
    (await isFile(paths.marketplaceManifestPath)) &&
    (await isFile(paths.pluginManifestPath)) &&
    (await isFile(paths.pluginHooksPath));

  if (settings.status === "invalid" || settings.status === "error") {
    return unreadableState(paths, "Claude settings unreadable");
  }
  if (known.status === "invalid" || known.status === "error") {
    return unreadableState(paths, "Claude marketplace registry unreadable");
  }
  if (installed.status === "invalid" || installed.status === "error") {
    return unreadableState(paths, "Claude plugin registry unreadable");
  }

  const enabled = settings.value?.enabledPlugins?.[paths.pluginRef] === true;
  const declaredMarketplace = marketplaceMatchesPath({
    marketplaceEntry: known.value?.[CLAUDE_PLUGIN_MARKETPLACE_NAME],
    marketplaceDir: paths.marketplaceDir,
  });
  const installedEntries = Array.isArray(installed.value?.plugins?.[paths.pluginRef])
    ? installed.value.plugins[paths.pluginRef]
    : [];
  const installedUserEntry =
    installedEntries.find((entry) => String(entry?.scope || "") === "user") || null;

  return {
    configured: Boolean(enabled && installedUserEntry && pluginFilesReady && declaredMarketplace),
    enabled,
    installed: Boolean(installedUserEntry),
    marketplaceDeclared: declaredMarketplace,
    pluginFilesReady,
    pluginRef: paths.pluginRef,
    unreadable: false,
    detail: null,
    ...paths,
  };
}

async function installClaudePlugin({
  home = os.homedir(),
  trackerDir,
  notifyPath,
  env = process.env,
} = {}) {
  const paths = resolveClaudePluginPaths({ home, trackerDir });
  await ensureClaudePluginFiles({ trackerDir, notifyPath });

  const initialState = await probeClaudePluginState({ home, trackerDir });
  if (initialState.unreadable) {
    return { configured: false, skippedReason: "claude-config-unreadable", ...initialState };
  }

  const marketplaceCmd = initialState.marketplaceDeclared
    ? ["plugin", "marketplace", "update", CLAUDE_PLUGIN_MARKETPLACE_NAME]
    : ["plugin", "marketplace", "add", paths.marketplaceDir, "--scope", "user"];
  const marketplaceResult = runClaudeCli(marketplaceCmd, env);
  if (marketplaceResult.skippedReason) {
    return { configured: false, ...paths, ...marketplaceResult };
  }

  let actionResult;
  if (!initialState.installed) {
    actionResult = runClaudeCli(["plugin", "install", paths.pluginRef, "--scope", "user"], env);
  } else if (!initialState.enabled) {
    actionResult = runClaudeCli(["plugin", "enable", paths.pluginRef, "--scope", "user"], env);
  } else {
    actionResult = runClaudeCli(["plugin", "update", paths.pluginRef, "--scope", "user"], env);
  }
  if (actionResult.skippedReason) {
    return { configured: false, ...paths, ...actionResult };
  }

  const nextState = await probeClaudePluginState({ home, trackerDir });
  return {
    configured: nextState.configured,
    changed: !initialState.configured || !initialState.enabled || !initialState.marketplaceDeclared,
    stdout: `${marketplaceResult.stdout || ""}\n${actionResult.stdout || ""}`.trim(),
    stderr: `${marketplaceResult.stderr || ""}\n${actionResult.stderr || ""}`.trim(),
    ...nextState,
  };
}

async function removeClaudePluginConfig({
  home = os.homedir(),
  trackerDir,
  env = process.env,
} = {}) {
  const paths = resolveClaudePluginPaths({ home, trackerDir });
  const initialState = await probeClaudePluginState({ home, trackerDir });
  const hadMarketplaceDir = await isDir(paths.marketplaceDir);

  let changed = false;
  let skippedReason = null;
  if (initialState.installed || initialState.enabled) {
    const uninstallResult = runClaudeCli(["plugin", "uninstall", paths.pluginRef, "--scope", "user"], env);
    if (uninstallResult.skippedReason) {
      return { removed: false, ...paths, ...uninstallResult };
    }
    changed = true;
  }

  const siblingRefs = await listMarketplaceSiblingPluginRefs({
    installedPluginsPath: paths.installedPluginsPath,
    marketplaceName: CLAUDE_PLUGIN_MARKETPLACE_NAME,
    excludePluginRef: paths.pluginRef,
  });

  const shouldRemoveMarketplace =
    initialState.marketplaceDeclared && siblingRefs.unreadable !== true && siblingRefs.refs.length === 0;

  if (shouldRemoveMarketplace) {
    const removeMarketplaceResult = runClaudeCli(
      ["plugin", "marketplace", "remove", CLAUDE_PLUGIN_MARKETPLACE_NAME],
      env,
    );
    if (removeMarketplaceResult.skippedReason && removeMarketplaceResult.skippedReason !== "claude-cli-error") {
      return { removed: changed, ...paths, ...removeMarketplaceResult };
    }
    changed = true;
  } else if (!changed) {
    skippedReason = "plugin-missing";
  }

  if (shouldRemoveMarketplace) {
    await fs.rm(paths.marketplaceDir, { recursive: true, force: true }).catch(() => {});
  }
  return {
    removed: changed || (hadMarketplaceDir && shouldRemoveMarketplace),
    skippedReason,
    siblingPluginRefs: siblingRefs.refs,
    ...paths,
  };
}

function runClaudeCli(args, env = process.env) {
  let res;
  try {
    res = cp.spawnSync("claude", args, {
      env,
      encoding: "utf8",
      timeout: 30_000,
    });
  } catch (err) {
    return {
      code: 1,
      skippedReason: err?.code === "ENOENT" ? "claude-cli-missing" : "claude-cli-error",
      error: err?.message || String(err),
      stdout: "",
      stderr: "",
    };
  }

  if (res.error?.code === "ENOENT") {
    return {
      code: 1,
      skippedReason: "claude-cli-missing",
      error: res.error.message,
      stdout: res.stdout || "",
      stderr: res.stderr || "",
    };
  }

  if ((res.status || 0) !== 0) {
    return {
      code: Number(res.status || 1),
      skippedReason: "claude-cli-error",
      error: (res.stderr || res.stdout || "").trim() || "claude plugin command failed",
      stdout: res.stdout || "",
      stderr: res.stderr || "",
    };
  }

  return {
    code: 0,
    stdout: res.stdout || "",
    stderr: res.stderr || "",
  };
}

function buildMarketplaceManifest() {
  return `${JSON.stringify(
    {
      $schema: "https://anthropic.com/claude-code/marketplace.schema.json",
      name: CLAUDE_PLUGIN_MARKETPLACE_NAME,
      description: "Local VibeUsage Claude plugin marketplace.",
      owner: {
        name: "VibeUsage",
        email: "support@vibeusage.cc",
      },
      version: CLAUDE_PLUGIN_VERSION,
      plugins: [
        {
          name: CLAUDE_PLUGIN_ID,
          source: `./plugins/${CLAUDE_PLUGIN_ID}`,
          description: "Trigger VibeUsage Claude notify bridge on Claude session lifecycle events.",
          version: CLAUDE_PLUGIN_VERSION,
          strict: false,
        },
      ],
    },
    null,
    2,
  )}\n`;
}

function buildPluginManifest() {
  return `${JSON.stringify(
    {
      name: CLAUDE_PLUGIN_ID,
      description: "Trigger VibeUsage Claude notify bridge on Claude session lifecycle events.",
      version: CLAUDE_PLUGIN_VERSION,
    },
    null,
    2,
  )}\n`;
}

function buildPluginHooks({ notifyPath }) {
  const hookCommand = buildClaudeHookCommand(notifyPath);
  return `${JSON.stringify(
    {
      description: "Run VibeUsage Claude notify bridge on Stop and SessionEnd events.",
      hooks: {
        Stop: [
          {
            hooks: [{ type: "command", command: hookCommand }],
          },
        ],
        SessionEnd: [
          {
            hooks: [{ type: "command", command: hookCommand }],
          },
        ],
      },
    },
    null,
    2,
  )}\n`;
}

function unreadableState(paths, detail) {
  return {
    configured: false,
    enabled: false,
    installed: false,
    marketplaceDeclared: false,
    pluginFilesReady: false,
    pluginRef: paths.pluginRef,
    unreadable: true,
    detail,
    ...paths,
  };
}

function marketplaceMatchesPath({ marketplaceEntry, marketplaceDir } = {}) {
  if (!marketplaceEntry || typeof marketplaceEntry !== "object") return false;

  const source = marketplaceEntry.source;
  if (!source || typeof source !== "object") return false;
  if (source.source !== "path") return false;
  if (typeof source.path !== "string" || source.path.length === 0) return false;

  return path.resolve(source.path) === path.resolve(marketplaceDir);
}

async function listMarketplaceSiblingPluginRefs({
  installedPluginsPath,
  marketplaceName,
  excludePluginRef,
} = {}) {
  const installed = await readJsonStrict(installedPluginsPath);
  if (installed.status === "invalid") {
    return { unreadable: true, refs: [] };
  }

  const plugins =
    installed.value?.plugins && typeof installed.value.plugins === "object"
      ? installed.value.plugins
      : {};
  const refs = Object.entries(plugins)
    .filter(([ref, entries]) => {
      if (ref === excludePluginRef) return false;
      if (!ref.endsWith(`@${marketplaceName}`)) return false;
      return Array.isArray(entries) && entries.length > 0;
    })
    .map(([ref]) => ref);

  return { unreadable: false, refs };
}

function isNonEmptyObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function isFile(targetPath) {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isFile();
  } catch (_err) {
    return false;
  }
}

async function isDir(targetPath) {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isDirectory();
  } catch (_err) {
    return false;
  }
}

module.exports = {
  CLAUDE_PLUGIN_MARKETPLACE_NAME,
  CLAUDE_PLUGIN_ID,
  resolveClaudePluginPaths,
  ensureClaudePluginFiles,
  probeClaudePluginState,
  installClaudePlugin,
  removeClaudePluginConfig,
};
