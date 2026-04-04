const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const fssync = require("node:fs");
const cp = require("node:child_process");
const { pathToFileURL } = require("node:url");

const OPENCLAW_SESSION_PLUGIN_ID = "openclaw-session-sync";
const OPENCLAW_SESSION_PLUGIN_DIRNAME = "openclaw-plugin";

function resolveOpenclawSessionPluginPaths({
  home = os.homedir(),
  trackerDir,
  env = process.env,
} = {}) {
  if (!trackerDir) throw new Error("trackerDir is required");

  const openclawConfigPath =
    normalizeString(env.OPENCLAW_CONFIG_PATH) || path.join(home, ".openclaw", "openclaw.json");

  const openclawHome =
    normalizeString(env.VIBEUSAGE_OPENCLAW_HOME) ||
    normalizeString(env.OPENCLAW_STATE_DIR) ||
    path.join(home, ".openclaw");

  const pluginDir = path.join(trackerDir, OPENCLAW_SESSION_PLUGIN_DIRNAME);
  const pluginEntryDir = path.join(pluginDir, OPENCLAW_SESSION_PLUGIN_ID);

  return {
    pluginId: OPENCLAW_SESSION_PLUGIN_ID,
    pluginDir,
    pluginEntryDir,
    openclawConfigPath,
    openclawHome,
  };
}

async function installOpenclawSessionPlugin({
  home = os.homedir(),
  trackerDir,
  packageName = "vibeusage",
  env = process.env,
} = {}) {
  const paths = resolveOpenclawSessionPluginPaths({ home, trackerDir, env });

  await ensureOpenclawSessionPluginFiles({
    pluginDir: paths.pluginDir,
    trackerDir,
    packageName,
    openclawHome: paths.openclawHome,
  });

  const installResult = runOpenclawCli(["plugins", "install", "--link", paths.pluginEntryDir], env);
  if (installResult.skippedReason) {
    return { configured: false, ...paths, ...installResult };
  }

  const enableResult = runOpenclawCli(["plugins", "enable", paths.pluginId], env);
  if (enableResult.skippedReason) {
    return {
      configured: false,
      ...paths,
      skippedReason: enableResult.skippedReason,
      error: enableResult.error,
      stdout: `${installResult.stdout || ""}\n${enableResult.stdout || ""}`.trim(),
      stderr: `${installResult.stderr || ""}\n${enableResult.stderr || ""}`.trim(),
      code: enableResult.code,
    };
  }

  const state = await probeOpenclawSessionPluginState({ home, trackerDir, env });
  return {
    configured: state.configured,
    changed:
      /Linked plugin path:/i.test(installResult.stdout || "") ||
      /Enabled plugin/i.test(enableResult.stdout || "") ||
      /already enabled/i.test(enableResult.stdout || ""),
    ...paths,
    stdout: `${installResult.stdout || ""}\n${enableResult.stdout || ""}`.trim(),
    stderr: `${installResult.stderr || ""}\n${enableResult.stderr || ""}`.trim(),
    code: enableResult.code,
  };
}

async function ensureOpenclawSessionPluginFiles({
  pluginDir,
  trackerDir,
  packageName = "vibeusage",
  openclawHome,
} = {}) {
  if (!pluginDir || !trackerDir) throw new Error("pluginDir and trackerDir are required");

  const pluginEntryDir = path.join(pluginDir, OPENCLAW_SESSION_PLUGIN_ID);
  await fs.mkdir(pluginEntryDir, { recursive: true });

  const packageJsonPath = path.join(pluginEntryDir, "package.json");
  const pluginMetaPath = path.join(pluginEntryDir, "openclaw.plugin.json");
  const indexPath = path.join(pluginEntryDir, "index.js");

  await fs.writeFile(packageJsonPath, buildSessionPluginPackageJson(), "utf8");
  await fs.writeFile(pluginMetaPath, buildSessionPluginMeta(), "utf8");
  await fs.writeFile(
    indexPath,
    buildSessionPluginIndex({
      trackerDir,
      packageName,
    }),
    "utf8",
  );
}

async function probeOpenclawSessionPluginState({
  home = os.homedir(),
  trackerDir,
  env = process.env,
} = {}) {
  const paths = resolveOpenclawSessionPluginPaths({ home, trackerDir, env });
  const { openclawConfigPath, pluginEntryDir, pluginId } = paths;

  const pluginFilesReady =
    fssync.existsSync(path.join(pluginEntryDir, "package.json")) &&
    fssync.existsSync(path.join(pluginEntryDir, "index.js"));

  let cfg = null;
  try {
    const raw = await fs.readFile(openclawConfigPath, "utf8");
    cfg = JSON.parse(raw);
  } catch (err) {
    if (err?.code === "ENOENT" || err?.code === "ENOTDIR") {
      return {
        configured: false,
        enabled: false,
        linked: false,
        installed: false,
        pluginFilesReady,
        skippedReason: "openclaw-config-missing",
        ...paths,
      };
    }
    return {
      configured: false,
      enabled: false,
      linked: false,
      installed: false,
      pluginFilesReady,
      skippedReason: "openclaw-config-unreadable",
      error: err?.message || String(err),
      ...paths,
    };
  }

  const pluginEntry = cfg?.plugins?.entries?.[pluginId];
  const enabled = pluginEntry ? pluginEntry.enabled !== false : false;

  const loadPaths = Array.isArray(cfg?.plugins?.load?.paths) ? cfg.plugins.load.paths : [];
  const normalizedPluginEntryDir = path.resolve(pluginEntryDir);
  const linked = loadPaths.some(
    (entry) => path.resolve(String(entry || "")) === normalizedPluginEntryDir,
  );

  const installs =
    cfg?.plugins?.installs && typeof cfg.plugins.installs === "object" ? cfg.plugins.installs : {};
  const installEntry = installs[pluginId];
  const installed = Boolean(installEntry);

  return {
    configured: enabled && linked && pluginFilesReady,
    enabled,
    linked,
    installed,
    pluginFilesReady,
    ...paths,
  };
}

async function removeOpenclawSessionPluginConfig({
  home = os.homedir(),
  trackerDir,
  env = process.env,
} = {}) {
  const paths = resolveOpenclawSessionPluginPaths({ home, trackerDir, env });
  const { openclawConfigPath, pluginEntryDir, pluginId } = paths;

  let cfg;
  try {
    cfg = JSON.parse(await fs.readFile(openclawConfigPath, "utf8"));
  } catch (err) {
    if (err?.code === "ENOENT" || err?.code === "ENOTDIR") {
      return { removed: false, skippedReason: "openclaw-config-missing", ...paths };
    }
    return {
      removed: false,
      skippedReason: "openclaw-config-unreadable",
      error: err?.message || String(err),
      ...paths,
    };
  }

  let changed = false;
  const plugins = cfg?.plugins;

  if (plugins?.entries && Object.prototype.hasOwnProperty.call(plugins.entries, pluginId)) {
    delete plugins.entries[pluginId];
    changed = true;
    if (Object.keys(plugins.entries).length === 0) delete plugins.entries;
  }

  if (plugins?.load && Array.isArray(plugins.load.paths)) {
    const target = path.resolve(pluginEntryDir);
    const after = plugins.load.paths.filter(
      (entry) => path.resolve(String(entry || "")) !== target,
    );
    if (after.length !== plugins.load.paths.length) {
      plugins.load.paths = after;
      changed = true;
      if (after.length === 0) delete plugins.load.paths;
      if (Object.keys(plugins.load).length === 0) delete plugins.load;
    }
  }

  if (plugins?.installs && typeof plugins.installs === "object") {
    const installs = plugins.installs;
    if (Object.prototype.hasOwnProperty.call(installs, pluginId)) {
      delete installs[pluginId];
      changed = true;
    }

    const target = path.resolve(pluginEntryDir);
    for (const [id, entry] of Object.entries(installs)) {
      const sourcePath = normalizeString(entry?.sourcePath);
      const installPath = normalizeString(entry?.installPath);
      if (
        (sourcePath && path.resolve(sourcePath) === target) ||
        (installPath && path.resolve(installPath) === target)
      ) {
        delete installs[id];
        changed = true;
      }
    }

    if (Object.keys(installs).length === 0) delete plugins.installs;
  }

  if (plugins && Object.keys(plugins).length === 0) {
    delete cfg.plugins;
    changed = true;
  }

  if (changed) {
    await fs.writeFile(openclawConfigPath, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
  }

  const hadFiles = await fs
    .stat(pluginEntryDir)
    .then((st) => st.isDirectory())
    .catch(() => false);
  await fs.rm(pluginEntryDir, { recursive: true, force: true }).catch(() => {});

  return { removed: changed || hadFiles, ...paths };
}

function runOpenclawCli(args, env = process.env) {
  let res;
  try {
    res = cp.spawnSync("openclaw", args, {
      env,
      encoding: "utf8",
      timeout: 30_000,
    });
  } catch (err) {
    return {
      code: 1,
      skippedReason: err?.code === "ENOENT" ? "openclaw-cli-missing" : "openclaw-cli-error",
      error: err?.message || String(err),
      stdout: "",
      stderr: "",
    };
  }

  if (res.error?.code === "ENOENT") {
    return {
      code: 1,
      skippedReason: "openclaw-cli-missing",
      error: res.error.message,
      stdout: res.stdout || "",
      stderr: res.stderr || "",
    };
  }

  if ((res.status || 0) !== 0) {
    return {
      code: Number(res.status || 1),
      skippedReason: "openclaw-plugins-install-failed",
      error: (res.stderr || res.stdout || "").trim() || "openclaw plugins install failed",
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

function buildSessionPluginPackageJson() {
  return `${JSON.stringify(
    {
      name: "@vibeusage/openclaw-session-sync",
      version: "0.0.0",
      private: true,
      type: "module",
      openclaw: {
        extensions: ["./index.js"],
      },
    },
    null,
    2,
  )}\n`;
}

function buildSessionPluginMeta() {
  return `${JSON.stringify(
    {
      id: OPENCLAW_SESSION_PLUGIN_ID,
      name: "VibeUsage OpenClaw Session Sync",
      description: "Trigger vibeusage sync on OpenClaw agent/session lifecycle events.",
      configSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    },
    null,
    2,
  )}\n`;
}

function buildSessionPluginIndex({ trackerDir }) {
  const ledgerModuleUrl = pathToFileURL(
    path.join(trackerDir, "app", "src", "lib", "openclaw-usage-ledger.js"),
  ).href;

  return (
    `import { appendOpenclawUsageEvent } from ${JSON.stringify(ledgerModuleUrl)};\n` +
    `\n` +
    `const trackerDir = ${JSON.stringify(trackerDir)};\n` +
    `\n` +
    `export default function register(api) {\n` +
    `  api.on('llm_output', async (event, ctx) => {\n` +
    `    try {\n` +
    `      const payload = buildPayload(event, ctx);\n` +
    `      if (!payload) return;\n` +
    `      await appendOpenclawUsageEvent({ trackerDir, payload });\n` +
    `    } catch (_) {}\n` +
    `  });\n` +
    `}\n` +
    `\n` +
    `function buildPayload(event, ctx) {\n` +
    `  const usage = normalizeUsage(event);\n` +
    `  if (!usage) return null;\n` +
    `\n` +
    `  const sessionKey = normalize(ctx && ctx.sessionKey);\n` +
    `  if (!sessionKey) return null;\n` +
    `\n` +
    `  return {\n` +
    `    emittedAt: normalizeIso(event && (event.emittedAt || event.timestamp)) || new Date().toISOString(),\n` +
    `    source: 'openclaw',\n` +
    `    agentId: normalize(ctx && ctx.agentId),\n` +
    `    sessionKey,\n` +
    `    provider: normalize(event && event.provider) || normalize(ctx && ctx.provider),\n` +
    `    model: normalize(event && event.model) || normalize(ctx && ctx.model),\n` +
    `    channel: normalize(ctx && ctx.channel),\n` +
    `    chatType: normalize(ctx && ctx.chatType),\n` +
    `    trigger: normalize(ctx && ctx.trigger) || 'llm_output',\n` +
    `    ...usage\n` +
    `  };\n` +
    `}\n` +
    `\n` +
    `function normalizeUsage(event) {\n` +
    `  const usage = event && typeof event.usage === 'object' ? event.usage : event || {};\n` +
    `  const normalized = {\n` +
    `    inputTokens: toNonNegativeInt(usage.inputTokens ?? usage.input_tokens ?? usage.input),\n` +
    `    cachedInputTokens: toNonNegativeInt(usage.cachedInputTokens ?? usage.cached_input_tokens ?? usage.cacheRead ?? 0) + toNonNegativeInt(usage.cacheWrite ?? 0),\n` +
    `    outputTokens: toNonNegativeInt(usage.outputTokens ?? usage.output_tokens ?? usage.output),\n` +
    `    reasoningOutputTokens: toNonNegativeInt(usage.reasoningOutputTokens ?? usage.reasoning_output_tokens),\n` +
    `    totalTokens: toNonNegativeInt(usage.totalTokens ?? usage.total_tokens)\n` +
    `  };\n` +
    `  const sum = normalized.inputTokens + normalized.cachedInputTokens + normalized.outputTokens + normalized.reasoningOutputTokens + normalized.totalTokens;\n` +
    `  return sum > 0 ? normalized : null;\n` +
    `}\n` +
    `\n` +
    `function normalize(v) {\n` +
    `  if (typeof v !== 'string') return null;\n` +
    `  const s = v.trim();\n` +
    `  return s.length > 0 ? s : null;\n` +
    `}\n` +
    `\n` +
    `function normalizeIso(v) {\n` +
    `  const s = normalize(v);\n` +
    `  if (!s) return null;\n` +
    `  const ms = Date.parse(s);\n` +
    `  if (!Number.isFinite(ms)) return null;\n` +
    `  return new Date(ms).toISOString();\n` +
    `}\n` +
    `\n` +
    `function toNonNegativeInt(v) {\n` +
    `  const n = Number(v || 0);\n` +
    `  if (!Number.isFinite(n) || n < 0) return 0;\n` +
    `  return Math.floor(n);\n` +
    `}\n`
  );
}

function normalizeString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

module.exports = {
  OPENCLAW_SESSION_PLUGIN_ID,
  OPENCLAW_SESSION_PLUGIN_DIRNAME,
  resolveOpenclawSessionPluginPaths,
  ensureOpenclawSessionPluginFiles,
  installOpenclawSessionPlugin,
  probeOpenclawSessionPluginState,
  removeOpenclawSessionPluginConfig,
};
