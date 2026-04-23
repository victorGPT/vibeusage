const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const fssync = require("node:fs");
const cp = require("node:child_process");
const crypto = require("node:crypto");

const {
  ensureDir,
  writeFileAtomic,
  readJson,
  writeJson,
  chmod600IfPossible,
} = require("../lib/fs");
const { prompt, promptHidden } = require("../lib/prompt");
const { beginBrowserAuth, openInBrowser } = require("../lib/browser-auth");
const {
  issueDeviceTokenWithPassword,
  issueDeviceTokenWithAccessToken,
  issueDeviceTokenWithLinkCode,
} = require("../lib/insforge");
const { resolveTrackerPaths } = require("../lib/tracker-paths");
const { resolveRuntimeConfig } = require("../lib/runtime-config");
const {
  BOLD,
  DIM,
  CYAN,
  RESET,
  color,
  isInteractive,
  promptMenu,
  createSpinner,
} = require("../lib/cli-ui");
const { renderLocalReport, renderAuthTransition, renderSuccessBox } = require("../lib/init-flow");
const {
  createIntegrationContext,
  installIntegrations,
  probeIntegrations,
  summarizeProbeForInitPreview,
} = require("../lib/integrations");
const { DEFAULT_DASHBOARD_URL } = require("../shared/runtime-defaults.cjs");

const ASCII_LOGO = [
  "██╗   ██╗██╗██████╗ ███████╗██╗   ██╗███████╗ █████╗  ██████╗ ███████╗",
  "██║   ██║██║██╔══██╗██╔════╝██║   ██║██╔════╝██╔══██╗██╔════╝ ██╔════╝",
  "██║   ██║██║██████╔╝█████╗  ██║   ██║███████╗███████║██║  ███╗█████╗",
  "╚██╗ ██╔╝██║██╔══██╗██╔══╝  ██║   ██║╚════██║██╔══██║██║   ██║██╔══╝",
  " ╚████╔╝ ██║██████╔╝███████╗╚██████╔╝███████║██║  ██║╚██████╔╝███████╗",
  "  ╚═══╝  ╚═╝╚═════╝ ╚══════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝",
].join("\n");

const DIVIDER = "----------------------------------------------";
async function cmdInit(argv) {
  const opts = parseArgs(argv);
  const home = os.homedir();

  const { trackerDir, binDir } = await resolveTrackerPaths({ home });

  const configPath = path.join(trackerDir, "config.json");
  const linkCodeStatePath = path.join(trackerDir, "link_code_state.json");

  const existingConfig = await readJson(configPath);
  const runtime = resolveRuntimeConfig({
    cli: { baseUrl: opts.baseUrl, dashboardUrl: opts.dashboardUrl },
    config: existingConfig || {},
    env: process.env,
  });
  const baseUrl = runtime.baseUrl;
  let dashboardUrl = runtime.dashboardUrl || DEFAULT_DASHBOARD_URL;
  const notifyPath = path.join(binDir, "notify.cjs");
  const appDir = path.join(trackerDir, "app");
  const trackerBinPath = path.join(appDir, "bin", "tracker.js");

  renderWelcome();

  if (opts.dryRun) {
    process.stdout.write(`${color("Dry run: preview only (no changes applied).", DIM)}\n\n`);
  }

  if (isInteractive() && !opts.yes && !opts.dryRun) {
    const choice = await promptMenu({
      message: "? Proceed with installation?",
      options: ["Yes, configure my environment", "No, exit"],
      defaultIndex: 0,
    });
    const normalizedChoice = String(choice || "")
      .trim()
      .toLowerCase();
    if (normalizedChoice.startsWith("no") || normalizedChoice.includes("exit")) {
      process.stdout.write("Setup cancelled.\n");
      return;
    }
  }

  if (opts.dryRun) {
    const preview = await buildDryRunSummary({
      opts,
      home,
      trackerDir,
      notifyPath,
      runtime,
    });
    renderLocalReport({ summary: preview.summary, isDryRun: true });
    if (preview.pendingBrowserAuth) {
      process.stdout.write("Account linking would be required for full setup.\n");
    } else if (!preview.deviceToken) {
      renderAccountNotLinked({ context: "dry-run" });
    }
    return;
  }

  const spinner = createSpinner({ text: "Analyzing and configuring local environment..." });
  spinner.start();
  let setup;
  try {
    setup = await runSetup({
      opts,
      home,
      baseUrl,
      trackerDir,
      binDir,
      configPath,
      linkCodeStatePath,
      notifyPath,
      appDir,
      trackerBinPath,
      runtime,
      existingConfig,
    });
  } catch (err) {
    spinner.stop();
    throw err;
  }
  spinner.stop();

  renderLocalReport({ summary: setup.summary, isDryRun: false });

  let deviceToken = setup.deviceToken;
  let deviceId = setup.deviceId;

  if (setup.pendingBrowserAuth) {
    const deviceName = opts.deviceName || os.hostname();
    const flow = await beginBrowserAuth({
      baseUrl,
      dashboardUrl,
      timeoutMs: 10 * 60_000,
      open: false,
    });
    const canAutoOpen = !opts.noOpen;
    renderAuthTransition({ authUrl: flow.authUrl, canAutoOpen });
    if (canAutoOpen) {
      if (isInteractive()) await sleep(250);
      openInBrowser(flow.authUrl);
    }
    const callback = await flow.waitForCallback();
    const issued = await issueDeviceTokenWithAccessToken({
      baseUrl,
      accessToken: callback.accessToken,
      deviceName,
    });
    deviceToken = issued.token;
    deviceId = issued.deviceId;
    await writeJson(configPath, { baseUrl, deviceToken, deviceId, installedAt: setup.installedAt });
    await chmod600IfPossible(configPath);
    const resolvedDashboardUrl = dashboardUrl || null;
    renderSuccessBox({ configPath, dashboardUrl: resolvedDashboardUrl });
  } else if (deviceToken) {
    const resolvedDashboardUrl = dashboardUrl || null;
    renderSuccessBox({ configPath, dashboardUrl: resolvedDashboardUrl });
  } else {
    renderAccountNotLinked();
  }

  try {
    spawnInitSync({ trackerBinPath, packageName: "vibeusage" });
  } catch (err) {
    const msg = err && err.message ? err.message : "unknown error";
    process.stderr.write(`Initial sync spawn failed: ${msg}\n`);
  }
}

function renderWelcome() {
  process.stdout.write(
    [
      ASCII_LOGO,
      "",
      `${BOLD}Welcome to VibeScore CLI${RESET}`,
      DIVIDER,
      `${CYAN}Privacy First: Your content stays local. We only upload token counts and minimal metadata, never prompts or responses.${RESET}`,
      DIVIDER,
      "",
      "This tool will:",
      "  - Analyze your local AI CLI configurations (Codex, Every Code, Claude, Gemini, Kimi, Opencode, Hermes, OpenClaw)",
      "  - Set up lightweight hooks to track your flow state",
      "  - Link your device to your VibeScore account",
      "",
      "(Nothing will be changed until you confirm below)",
      "",
    ].join("\n"),
  );
}

function renderAccountNotLinked({ context } = {}) {
  if (context === "dry-run") {
    process.stdout.write(
      [
        "",
        "Account not linked (dry run).",
        "Run init without --dry-run to link your account.",
        "",
      ].join("\n"),
    );
    return;
  }
  process.stdout.write(
    ["", "Account not linked.", "Set VIBEUSAGE_DEVICE_TOKEN then re-run init.", ""].join("\n"),
  );
}

function shouldUseBrowserAuth({ deviceToken, opts }) {
  if (deviceToken) return false;
  if (opts.noAuth) return false;
  if (opts.linkCode) return false;
  if (opts.email || opts.password) return false;
  return true;
}

async function buildDryRunSummary({ opts, home, trackerDir, notifyPath, runtime }) {
  const deviceToken = runtime?.deviceToken || null;
  const pendingBrowserAuth = shouldUseBrowserAuth({ deviceToken, opts });
  const context = await createIntegrationContext({
    home,
    env: process.env,
    trackerPaths: { trackerDir, binDir: path.dirname(notifyPath), rootDir: path.dirname(trackerDir) },
    notifyPath,
  });
  const probe = await probeIntegrations(context);
  const summary = probe.map((item) => summarizeProbeForInitPreview(item));
  return { summary, pendingBrowserAuth, deviceToken };
}

async function runSetup({
  opts,
  home,
  baseUrl,
  trackerDir,
  binDir,
  configPath,
  linkCodeStatePath,
  notifyPath,
  appDir,
  trackerBinPath,
  runtime,
  existingConfig,
}) {
  await ensureDir(trackerDir);
  await ensureDir(binDir);
  let deviceToken = runtime?.deviceToken || null;
  let deviceId = existingConfig?.deviceId || null;
  const installedAt = existingConfig?.installedAt || new Date().toISOString();
  let pendingBrowserAuth = false;

  await installLocalTrackerApp({ appDir });

  if (!deviceToken && opts.linkCode) {
    const deviceName = opts.deviceName || os.hostname();
    const platform = normalizePlatform(process.platform);
    const linkCode = String(opts.linkCode);
    const linkCodeHash = crypto.createHash("sha256").update(linkCode).digest("hex");
    const existingLinkState = await readJson(linkCodeStatePath);
    let requestId =
      existingLinkState?.linkCodeHash === linkCodeHash && existingLinkState?.requestId
        ? existingLinkState.requestId
        : null;
    if (!requestId) {
      requestId = crypto.randomUUID();
      await writeJson(linkCodeStatePath, {
        linkCodeHash,
        requestId,
        createdAt: new Date().toISOString(),
      });
      await chmod600IfPossible(linkCodeStatePath);
    }
    const issued = await issueDeviceTokenWithLinkCode({
      baseUrl,
      linkCode,
      requestId,
      deviceName,
      platform,
    });
    deviceToken = issued.token;
    deviceId = issued.deviceId;
    await fs.rm(linkCodeStatePath, { force: true });
  } else if (!deviceToken && !opts.noAuth) {
    const deviceName = opts.deviceName || os.hostname();

    if (opts.email || opts.password) {
      const email = opts.email || (await prompt("Email: "));
      const password = opts.password || (await promptHidden("Password: "));
      const issued = await issueDeviceTokenWithPassword({ baseUrl, email, password, deviceName });
      deviceToken = issued.token;
      deviceId = issued.deviceId;
    } else {
      pendingBrowserAuth = true;
    }
  }

  const config = {
    baseUrl,
    deviceToken,
    deviceId,
    installedAt,
  };

  await writeJson(configPath, config);
  await chmod600IfPossible(configPath);

  await writeFileAtomic(
    notifyPath,
    buildNotifyHandler({ trackerDir, trackerBinPath, packageName: "vibeusage" }),
  );
  await fs.chmod(notifyPath, 0o755).catch(() => {});

  const integrationContext = await createIntegrationContext({
    home,
    env: process.env,
    trackerPaths: { trackerDir, binDir, rootDir: path.dirname(trackerDir) },
    notifyPath,
  });
  const summary = await installIntegrations(integrationContext);

  return {
    summary,
    pendingBrowserAuth,
    deviceToken,
    deviceId,
    installedAt,
  };
}

function parseArgs(argv) {
  const out = {
    baseUrl: null,
    dashboardUrl: null,
    email: null,
    password: null,
    deviceName: null,
    linkCode: null,
    noAuth: false,
    noOpen: false,
    yes: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base-url") out.baseUrl = argv[++i] || null;
    else if (a === "--dashboard-url") out.dashboardUrl = argv[++i] || null;
    else if (a === "--email") out.email = argv[++i] || null;
    else if (a === "--password") out.password = argv[++i] || null;
    else if (a === "--device-name") out.deviceName = argv[++i] || null;
    else if (a === "--link-code") out.linkCode = argv[++i] || null;
    else if (a === "--no-auth") out.noAuth = true;
    else if (a === "--no-open") out.noOpen = true;
    else if (a === "--yes") out.yes = true;
    else if (a === "--dry-run") out.dryRun = true;
    else throw new Error(`Unknown option: ${a}`);
  }
  return out;
}

function sleep(ms) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePlatform(value) {
  if (value === "darwin") return "macos";
  if (value === "win32") return "windows";
  if (value === "linux") return "linux";
  return "unknown";
}

function buildNotifyHandler({ trackerDir, packageName }) {
  // Keep this file dependency-free: Node built-ins only.
  // It must never block Codex; it spawns sync in the background and exits 0.
  const queueSignalPath = path.join(trackerDir, "notify.signal");
  const originalPath = path.join(trackerDir, "codex_notify_original.json");
  const fallbackPkg = packageName || "vibeusage";
  const trackerBinPath = path.join(trackerDir, "app", "bin", "tracker.js");

  return `#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const rawArgs = process.argv.slice(2);
let source = 'codex';
const payloadArgs = [];
for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg === '--source') {
    source = rawArgs[i + 1] || source;
    i += 1;
    continue;
  }
  if (arg.startsWith('--source=')) {
    source = arg.slice('--source='.length) || source;
    continue;
  }
  payloadArgs.push(arg);
}

const trackerDir = ${JSON.stringify(trackerDir)};
const signalPath = ${JSON.stringify(queueSignalPath)};
const codexOriginalPath = ${JSON.stringify(originalPath)};
const codeOriginalPath = ${JSON.stringify(path.join(trackerDir, "code_notify_original.json"))};
const trackerBinPath = ${JSON.stringify(trackerBinPath)};
  const depsMarkerPath = path.join(trackerDir, 'app', 'node_modules', '@insforge', 'sdk', 'package.json');
  const configPath = path.join(trackerDir, 'config.json');
const fallbackPkg = ${JSON.stringify(fallbackPkg)};
const selfPath = path.resolve(__filename);
const home = os.homedir();
const debugLogPath = path.join(trackerDir, 'notify.debug.jsonl');
const debugEnabled = ['1', 'true'].includes((process.env.VIBEUSAGE_NOTIFY_DEBUG || '').toLowerCase());
const debugMaxBytesRaw = Number.parseInt(process.env.VIBEUSAGE_NOTIFY_DEBUG_MAX_BYTES || '', 10);
const debugMaxBytes = Number.isFinite(debugMaxBytesRaw) && debugMaxBytesRaw > 0
  ? debugMaxBytesRaw
  : 1_000_000;

try {
  fs.mkdirSync(trackerDir, { recursive: true });
  fs.writeFileSync(signalPath, new Date().toISOString(), { encoding: 'utf8' });
} catch (_) {}

if (debugEnabled) {
  try {
    let size = 0;
    try {
      size = fs.statSync(debugLogPath).size;
    } catch (err) {
      if (err && err.code !== 'ENOENT') throw err;
    }
    if (size < debugMaxBytes) {
      const entry = {
        ts: new Date().toISOString(),
        source,
        cwd: process.cwd()
      };
      fs.appendFileSync(debugLogPath, JSON.stringify(entry) + os.EOL, 'utf8');
    }
  } catch (_) {}
}

// Throttle spawn: at most once per 20 seconds.
try {
    const throttlePath = path.join(trackerDir, 'sync.throttle');
    let deviceToken = process.env.VIBEUSAGE_DEVICE_TOKEN || null;
    if (!deviceToken) {
      try {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (cfg && typeof cfg.deviceToken === 'string') deviceToken = cfg.deviceToken;
      } catch (_) {}
    }
    const canSync = Boolean(deviceToken && deviceToken.length > 0);
    const now = Date.now();
    let last = 0;
    try { last = Number(fs.readFileSync(throttlePath, 'utf8')) || 0; } catch (_) {}
    if (canSync && now - last > 20_000) {
    try { fs.writeFileSync(throttlePath, String(now), 'utf8'); } catch (_) {}
    const hasLocalRuntime = fs.existsSync(trackerBinPath);
    const hasLocalDeps = fs.existsSync(depsMarkerPath);
    if (hasLocalRuntime && hasLocalDeps) {
      spawnDetached([process.execPath, trackerBinPath, 'sync', '--auto', '--from-notify']);
    } else {
      spawnDetached(['npx', '--yes', fallbackPkg, 'sync', '--auto', '--from-notify']);
    }
  }
} catch (_) {}

// Chain the original notify if present (Codex/Every Code only).
try {
  const originalPath =
    source === 'every-code'
      ? codeOriginalPath
      : source === 'claude' || source === 'opencode' || source === 'gemini' || source === 'kimi'
        ? null
        : codexOriginalPath;
  if (originalPath) {
    const original = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
    const cmd = Array.isArray(original?.notify) ? original.notify : null;
    if (cmd && cmd.length > 0 && !isSelfNotify(cmd)) {
      const args = cmd.slice(1);
      if (payloadArgs.length > 0) args.push(...payloadArgs);
      spawnDetached([cmd[0], ...args]);
    }
  }
} catch (_) {}

process.exit(0);

function spawnDetached(argv) {
  try {
    const child = cp.spawn(argv[0], argv.slice(1), {
      detached: true,
      stdio: 'ignore',
      env: process.env
    });
    child.unref();
  } catch (_) {}
}

function resolveMaybeHome(p) {
  if (typeof p !== 'string') return null;
  if (p.startsWith('~/')) return path.join(home, p.slice(2));
  return path.resolve(p);
}

function isSelfNotify(cmd) {
  for (const part of cmd) {
    if (typeof part !== 'string') continue;
    if (!part.includes('notify.cjs')) continue;
    const resolved = resolveMaybeHome(part);
    if (resolved && resolved === selfPath) return true;
  }
  return false;
}
`;
}

module.exports = { cmdInit };

async function installLocalTrackerApp({ appDir }) {
  // Copy the current package's runtime (bin + src) into ~/.vibeusage so notify can run sync without npx.
  const packageRoot = path.resolve(__dirname, "../..");
  const srcFrom = path.join(packageRoot, "src");
  const binFrom = path.join(packageRoot, "bin", "tracker.js");
  const nodeModulesFrom = path.join(packageRoot, "node_modules");

  // When running from the installed local runtime (or when appDir is symlinked to this package),
  // source and destination resolve to the same place. Do not delete appDir in that case.
  if (await pathsPointToSameLocation(packageRoot, appDir)) {
    return;
  }

  const srcTo = path.join(appDir, "src");
  const binToDir = path.join(appDir, "bin");
  const binTo = path.join(binToDir, "tracker.js");
  const nodeModulesTo = path.join(appDir, "node_modules");

  await fs.rm(appDir, { recursive: true, force: true }).catch(() => {});
  await ensureDir(appDir);
  await fs.cp(srcFrom, srcTo, { recursive: true });
  await ensureDir(binToDir);
  await fs.copyFile(binFrom, binTo);
  await fs.chmod(binTo, 0o755).catch(() => {});
  await copyRuntimeDependencies({ from: nodeModulesFrom, to: nodeModulesTo });
}

async function pathsPointToSameLocation(a, b) {
  const aReal = await safeRealpath(a);
  const bReal = await safeRealpath(b);
  if (aReal && bReal) return aReal === bReal;
  return path.resolve(a) === path.resolve(b);
}

async function safeRealpath(p) {
  try {
    return await fs.realpath(p);
  } catch (_err) {
    return null;
  }
}

function spawnInitSync({ trackerBinPath, packageName }) {
  const fallbackPkg = packageName || "vibeusage";
  const argv = ["sync", "--drain"];
  const hasLocalRuntime = typeof trackerBinPath === "string" && fssync.existsSync(trackerBinPath);
  const cmd = hasLocalRuntime
    ? [process.execPath, trackerBinPath, ...argv]
    : ["npx", "--yes", fallbackPkg, ...argv];
  const child = cp.spawn(cmd[0], cmd.slice(1), {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.on("error", (err) => {
    const msg = err && err.message ? err.message : "unknown error";
    const detail = isDebugEnabled() ? ` (${msg})` : "";
    process.stderr.write(`Minor issue: Background sync could not start${detail}.\n`);
    process.stderr.write("Run: npx --yes vibeusage sync\n");
  });
  child.unref();
}

async function copyRuntimeDependencies({ from, to }) {
  try {
    const st = await fs.stat(from);
    if (!st.isDirectory()) return;
  } catch (_e) {
    return;
  }

  try {
    await fs.cp(from, to, { recursive: true });
  } catch (_e) {
    // Best-effort: missing dependencies will fall back to npx at notify time.
  }
}

function isDebugEnabled() {
  return process.env.VIBEUSAGE_DEBUG === "1";
}
