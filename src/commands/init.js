const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const fssync = require('node:fs');
const cp = require('node:child_process');
const crypto = require('node:crypto');

const { ensureDir, writeFileAtomic, readJson, writeJson, chmod600IfPossible } = require('../lib/fs');
const { prompt, promptHidden } = require('../lib/prompt');
const {
  upsertCodexNotify,
  upsertEveryCodeNotify,
  readCodexNotify,
  readEveryCodeNotify
} = require('../lib/codex-config');
const { upsertClaudeHook, buildClaudeHookCommand, isClaudeHookConfigured } = require('../lib/claude-config');
const {
  resolveGeminiConfigDir,
  resolveGeminiSettingsPath,
  buildGeminiHookCommand,
  upsertGeminiHook,
  isGeminiHookConfigured
} = require('../lib/gemini-config');
const { resolveOpencodeConfigDir, upsertOpencodePlugin, isOpencodePluginInstalled } = require('../lib/opencode-config');
const { beginBrowserAuth, openInBrowser } = require('../lib/browser-auth');
const {
  issueDeviceTokenWithPassword,
  issueDeviceTokenWithAccessToken,
  issueDeviceTokenWithLinkCode
} = require('../lib/insforge');
const { resolveTrackerPaths } = require('../lib/tracker-paths');
const {
  BOLD,
  DIM,
  CYAN,
  RESET,
  color,
  isInteractive,
  promptMenu,
  createSpinner
} = require('../lib/cli-ui');
const { renderLocalReport, renderAuthTransition, renderSuccessBox } = require('../lib/init-flow');

const ASCII_LOGO = [
  '██╗   ██╗██╗██████╗ ███████╗███████╗ ██████╗  ██████╗ ██████╗ ███████╗',
  '██║   ██║██║██╔══██╗██╔════╝██╔════╝██╔════╝ ██╔═══██╗██╔══██╗██╔════╝',
  '██║   ██║██║██████╔╝█████╗  ███████╗██║      ██║   ██║██████╔╝█████╗',
  '╚██╗ ██╔╝██║██╔══██╗██╔══╝  ╚════██║██║      ██║   ██║██╔══██╗██╔══╝',
  ' ╚████╔╝ ██║██████╔╝███████╗███████║╚██████╗ ╚██████╔╝██║  ██║███████╗',
  '  ╚═══╝  ╚═╝╚═════╝ ╚══════╝╚══════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝'
].join('\n');

const DIVIDER = '----------------------------------------------';

async function cmdInit(argv) {
  const opts = parseArgs(argv);
  const home = os.homedir();

  const { rootDir, trackerDir, binDir } = await resolveTrackerPaths({ home, migrate: true });

  const configPath = path.join(trackerDir, 'config.json');
  const notifyOriginalPath = path.join(trackerDir, 'codex_notify_original.json');
  const linkCodeStatePath = path.join(trackerDir, 'link_code_state.json');

  const baseUrl = opts.baseUrl ||
    process.env.VIBEUSAGE_INSFORGE_BASE_URL ||
    process.env.VIBESCORE_INSFORGE_BASE_URL ||
    'https://5tmappuk.us-east.insforge.app';
  let dashboardUrl = opts.dashboardUrl ||
    process.env.VIBEUSAGE_DASHBOARD_URL ||
    process.env.VIBESCORE_DASHBOARD_URL ||
    null;
  const notifyPath = path.join(binDir, 'notify.cjs');
  const appDir = path.join(trackerDir, 'app');
  const trackerBinPath = path.join(appDir, 'bin', 'tracker.js');

  renderWelcome();

  if (opts.dryRun) {
    process.stdout.write(`${color('Dry run: preview only (no changes applied).', DIM)}\n\n`);
  }

  if (isInteractive() && !opts.yes && !opts.dryRun) {
    const choice = await promptMenu({
      message: '? Proceed with installation?',
      options: ['Yes, configure my environment', 'No, exit'],
      defaultIndex: 0
    });
    const normalizedChoice = String(choice || '').trim().toLowerCase();
    if (normalizedChoice.startsWith('no') || normalizedChoice.includes('exit')) {
      process.stdout.write('Setup cancelled.\n');
      return;
    }
  }

  if (opts.dryRun) {
    const preview = await buildDryRunSummary({
      opts,
      home,
      trackerDir,
      configPath,
      notifyPath
    });
    renderLocalReport({ summary: preview.summary, isDryRun: true });
    if (preview.pendingBrowserAuth) {
      process.stdout.write('Account linking would be required for full setup.\n');
    } else if (!preview.deviceToken) {
      renderAccountNotLinked({ context: 'dry-run' });
    }
    return;
  }

  const spinner = createSpinner({ text: 'Analyzing and configuring local environment...' });
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
      notifyOriginalPath,
      linkCodeStatePath,
      notifyPath,
      appDir,
      trackerBinPath
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
    if (!dashboardUrl) dashboardUrl = await detectLocalDashboardUrl();
    const flow = await beginBrowserAuth({ baseUrl, dashboardUrl, timeoutMs: 10 * 60_000, open: false });
    const canAutoOpen = !opts.noOpen;
    renderAuthTransition({ authUrl: flow.authUrl, canAutoOpen });
    if (canAutoOpen) {
      if (isInteractive()) await sleep(250);
      openInBrowser(flow.authUrl);
    }
    const callback = await flow.waitForCallback();
    const issued = await issueDeviceTokenWithAccessToken({ baseUrl, accessToken: callback.accessToken, deviceName });
    deviceToken = issued.token;
    deviceId = issued.deviceId;
    await writeJson(configPath, { baseUrl, deviceToken, deviceId, installedAt: setup.installedAt });
    await chmod600IfPossible(configPath);
    const resolvedDashboardUrl = dashboardUrl || null;
    renderSuccessBox({ configPath, dashboardUrl: resolvedDashboardUrl });
  } else if (deviceToken) {
    if (!dashboardUrl) dashboardUrl = await detectLocalDashboardUrl();
    const resolvedDashboardUrl = dashboardUrl || null;
    renderSuccessBox({ configPath, dashboardUrl: resolvedDashboardUrl });
  } else {
    renderAccountNotLinked();
  }

  try {
    spawnInitSync({ trackerBinPath, packageName: 'vibeusage' });
  } catch (err) {
    const msg = err && err.message ? err.message : 'unknown error';
    process.stderr.write(`Initial sync spawn failed: ${msg}\n`);
  }
}

function renderWelcome() {
  process.stdout.write(
    [
      ASCII_LOGO,
      '',
      `${BOLD}Welcome to VibeScore CLI${RESET}`,
      DIVIDER,
      `${CYAN}Privacy First: Your content stays local. We only upload token counts and minimal metadata, never prompts or responses.${RESET}`,
      DIVIDER,
      '',
      'This tool will:',
      '  - Analyze your local AI CLI configurations (Codex, Every Code, Claude, Gemini, Opencode)',
      '  - Set up lightweight hooks to track your flow state',
      '  - Link your device to your VibeScore account',
      '',
      '(Nothing will be changed until you confirm below)',
      ''
    ].join('\n')
  );
}

function renderAccountNotLinked({ context } = {}) {
  if (context === 'dry-run') {
    process.stdout.write(['', 'Account not linked (dry run).', 'Run init without --dry-run to link your account.', ''].join('\n'));
    return;
  }
  process.stdout.write(['', 'Account not linked.', 'Set VIBEUSAGE_DEVICE_TOKEN then re-run init.', ''].join('\n'));
}

function shouldUseBrowserAuth({ deviceToken, opts }) {
  if (deviceToken) return false;
  if (opts.noAuth) return false;
  if (opts.linkCode) return false;
  if (opts.email || opts.password) return false;
  return true;
}

async function buildDryRunSummary({ opts, home, trackerDir, configPath, notifyPath }) {
  const existingConfig = await readJson(configPath);
  const deviceTokenFromEnv = process.env.VIBEUSAGE_DEVICE_TOKEN || process.env.VIBESCORE_DEVICE_TOKEN || null;
  const deviceToken = deviceTokenFromEnv || existingConfig?.deviceToken || null;
  const pendingBrowserAuth = shouldUseBrowserAuth({ deviceToken, opts });
  const context = buildIntegrationTargets({ home, trackerDir, notifyPath });
  const summary = await previewIntegrations({ context });
  return { summary, pendingBrowserAuth, deviceToken };
}

async function runSetup({
  opts,
  home,
  baseUrl,
  trackerDir,
  binDir,
  configPath,
  notifyOriginalPath,
  linkCodeStatePath,
  notifyPath,
  appDir,
  trackerBinPath
}) {
  await ensureDir(trackerDir);
  await ensureDir(binDir);

  const existingConfig = await readJson(configPath);
  const deviceTokenFromEnv = process.env.VIBEUSAGE_DEVICE_TOKEN || process.env.VIBESCORE_DEVICE_TOKEN || null;

  let deviceToken = deviceTokenFromEnv || existingConfig?.deviceToken || null;
  let deviceId = existingConfig?.deviceId || null;
  const installedAt = existingConfig?.installedAt || new Date().toISOString();
  let pendingBrowserAuth = false;

  await installLocalTrackerApp({ appDir });

  if (!deviceToken && opts.linkCode) {
    const deviceName = opts.deviceName || os.hostname();
    const platform = normalizePlatform(process.platform);
    const linkCode = String(opts.linkCode);
    const linkCodeHash = crypto.createHash('sha256').update(linkCode).digest('hex');
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
        createdAt: new Date().toISOString()
      });
      await chmod600IfPossible(linkCodeStatePath);
    }
    const issued = await issueDeviceTokenWithLinkCode({
      baseUrl,
      linkCode,
      requestId,
      deviceName,
      platform
    });
    deviceToken = issued.token;
    deviceId = issued.deviceId;
    await fs.rm(linkCodeStatePath, { force: true });
  } else if (!deviceToken && !opts.noAuth) {
    const deviceName = opts.deviceName || os.hostname();

    if (opts.email || opts.password) {
      const email = opts.email || (await prompt('Email: '));
      const password = opts.password || (await promptHidden('Password: '));
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
    installedAt
  };

  await writeJson(configPath, config);
  await chmod600IfPossible(configPath);

  await writeFileAtomic(
    notifyPath,
    buildNotifyHandler({ trackerDir, trackerBinPath, packageName: 'vibeusage' })
  );
  await fs.chmod(notifyPath, 0o755).catch(() => {});

  const summary = await applyIntegrationSetup({
    home,
    trackerDir,
    notifyPath,
    notifyOriginalPath
  });

  return {
    summary,
    pendingBrowserAuth,
    deviceToken,
    deviceId,
    installedAt
  };
}

function buildIntegrationTargets({ home, trackerDir, notifyPath }) {
  const codexHome = process.env.CODEX_HOME || path.join(home, '.codex');
  const codexConfigPath = path.join(codexHome, 'config.toml');
  const codeHome = process.env.CODE_HOME || path.join(home, '.code');
  const codeConfigPath = path.join(codeHome, 'config.toml');
  const notifyOriginalPath = path.join(trackerDir, 'codex_notify_original.json');
  const codeNotifyOriginalPath = path.join(trackerDir, 'code_notify_original.json');
  const notifyCmd = ['/usr/bin/env', 'node', notifyPath];
  const codeNotifyCmd = ['/usr/bin/env', 'node', notifyPath, '--source=every-code'];
  const claudeDir = path.join(home, '.claude');
  const claudeSettingsPath = path.join(claudeDir, 'settings.json');
  const claudeHookCommand = buildClaudeHookCommand(notifyPath);
  const geminiConfigDir = resolveGeminiConfigDir({ home, env: process.env });
  const geminiSettingsPath = resolveGeminiSettingsPath({ configDir: geminiConfigDir });
  const geminiHookCommand = buildGeminiHookCommand(notifyPath);
  const opencodeConfigDir = resolveOpencodeConfigDir({ home, env: process.env });

  return {
    codexConfigPath,
    codeConfigPath,
    notifyOriginalPath,
    codeNotifyOriginalPath,
    notifyCmd,
    codeNotifyCmd,
    claudeDir,
    claudeSettingsPath,
    claudeHookCommand,
    geminiConfigDir,
    geminiSettingsPath,
    geminiHookCommand,
    opencodeConfigDir
  };
}

async function applyIntegrationSetup({ home, trackerDir, notifyPath, notifyOriginalPath }) {
  const context = buildIntegrationTargets({ home, trackerDir, notifyPath });
  context.notifyOriginalPath = notifyOriginalPath;

  const summary = [];

  const codexProbe = await probeFile(context.codexConfigPath);
  if (codexProbe.exists) {
    const result = await upsertCodexNotify({
      codexConfigPath: context.codexConfigPath,
      notifyCmd: context.notifyCmd,
      notifyOriginalPath: context.notifyOriginalPath
    });
    summary.push({
      label: 'Codex CLI',
      status: result.changed ? 'updated' : 'set',
      detail: result.changed ? 'Updated config' : 'Config already set'
    });
  } else {
    summary.push({ label: 'Codex CLI', status: 'skipped', detail: renderSkipDetail(codexProbe) });
  }

  const claudeDirExists = await isDir(context.claudeDir);
  if (claudeDirExists) {
    await upsertClaudeHook({
      settingsPath: context.claudeSettingsPath,
      hookCommand: context.claudeHookCommand
    });
    summary.push({ label: 'Claude', status: 'installed', detail: 'Hooks installed' });
  } else {
    summary.push({ label: 'Claude', status: 'skipped', detail: 'Config not found' });
  }

  const geminiConfigExists = await isDir(context.geminiConfigDir);
  if (geminiConfigExists) {
    await upsertGeminiHook({
      settingsPath: context.geminiSettingsPath,
      hookCommand: context.geminiHookCommand
    });
    summary.push({ label: 'Gemini', status: 'installed', detail: 'Hooks installed' });
  } else {
    summary.push({ label: 'Gemini', status: 'skipped', detail: 'Config not found' });
  }

  const opencodeResult = await upsertOpencodePlugin({
    configDir: context.opencodeConfigDir,
    notifyPath
  });
  if (opencodeResult?.skippedReason === 'config-missing') {
    summary.push({ label: 'Opencode Plugin', status: 'skipped', detail: 'Config not found' });
  } else {
    summary.push({ label: 'Opencode Plugin', status: opencodeResult?.changed ? 'installed' : 'set', detail: 'Plugin installed' });
  }

  const codeProbe = await probeFile(context.codeConfigPath);
  if (codeProbe.exists) {
    const result = await upsertEveryCodeNotify({
      codeConfigPath: context.codeConfigPath,
      notifyCmd: context.codeNotifyCmd,
      notifyOriginalPath: context.codeNotifyOriginalPath
    });
    summary.push({
      label: 'Every Code',
      status: result.changed ? 'updated' : 'set',
      detail: result.changed ? 'Updated config' : 'Config already set'
    });
  } else {
    summary.push({ label: 'Every Code', status: 'skipped', detail: renderSkipDetail(codeProbe) });
  }

  return summary;
}

async function previewIntegrations({ context }) {
  const summary = [];

  const codexProbe = await probeFile(context.codexConfigPath);
  if (codexProbe.exists) {
    const existing = await readCodexNotify(context.codexConfigPath);
    const matches = arraysEqual(existing, context.notifyCmd);
    summary.push({
      label: 'Codex CLI',
      status: matches ? 'set' : 'updated',
      detail: matches ? 'Already configured' : 'Will update config'
    });
  } else {
    summary.push({ label: 'Codex CLI', status: 'skipped', detail: renderSkipDetail(codexProbe) });
  }

  const claudeDirExists = await isDir(context.claudeDir);
  if (claudeDirExists) {
    const configured = await isClaudeHookConfigured({
      settingsPath: context.claudeSettingsPath,
      hookCommand: context.claudeHookCommand
    });
    summary.push({
      label: 'Claude',
      status: 'installed',
      detail: configured ? 'Hooks already installed' : 'Will install hooks'
    });
  } else {
    summary.push({ label: 'Claude', status: 'skipped', detail: 'Config not found' });
  }

  const geminiConfigExists = await isDir(context.geminiConfigDir);
  if (geminiConfigExists) {
    const configured = await isGeminiHookConfigured({
      settingsPath: context.geminiSettingsPath,
      hookCommand: context.geminiHookCommand
    });
    summary.push({
      label: 'Gemini',
      status: 'installed',
      detail: configured ? 'Hooks already installed' : 'Will install hooks'
    });
  } else {
    summary.push({ label: 'Gemini', status: 'skipped', detail: 'Config not found' });
  }

  const opencodeDirExists = await isDir(context.opencodeConfigDir);
  const installed = await isOpencodePluginInstalled({ configDir: context.opencodeConfigDir });
  const opencodeDetail = installed
    ? 'Plugin already installed'
    : opencodeDirExists
      ? 'Will install plugin'
      : 'Will create config and install plugin';
  summary.push({
    label: 'Opencode Plugin',
    status: 'installed',
    detail: opencodeDetail
  });

  const codeProbe = await probeFile(context.codeConfigPath);
  if (codeProbe.exists) {
    const existing = await readEveryCodeNotify(context.codeConfigPath);
    const matches = arraysEqual(existing, context.codeNotifyCmd);
    summary.push({
      label: 'Every Code',
      status: matches ? 'set' : 'updated',
      detail: matches ? 'Already configured' : 'Will update config'
    });
  } else {
    summary.push({ label: 'Every Code', status: 'skipped', detail: renderSkipDetail(codeProbe) });
  }

  return summary;
}

function renderSkipDetail(probe) {
  if (!probe || probe.reason === 'missing') return 'Config not found';
  if (probe.reason === 'permission-denied') return 'Permission denied';
  if (probe.reason === 'not-file') return 'Invalid config';
  return 'Unavailable';
}

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
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
    dryRun: false
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base-url') out.baseUrl = argv[++i] || null;
    else if (a === '--dashboard-url') out.dashboardUrl = argv[++i] || null;
    else if (a === '--email') out.email = argv[++i] || null;
    else if (a === '--password') out.password = argv[++i] || null;
    else if (a === '--device-name') out.deviceName = argv[++i] || null;
    else if (a === '--link-code') out.linkCode = argv[++i] || null;
    else if (a === '--no-auth') out.noAuth = true;
    else if (a === '--no-open') out.noOpen = true;
    else if (a === '--yes') out.yes = true;
    else if (a === '--dry-run') out.dryRun = true;
    else throw new Error(`Unknown option: ${a}`);
  }
  return out;
}

function sleep(ms) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePlatform(value) {
  if (value === 'darwin') return 'macos';
  if (value === 'win32') return 'windows';
  if (value === 'linux') return 'linux';
  return 'unknown';
}

function buildNotifyHandler({ trackerDir, packageName }) {
  // Keep this file dependency-free: Node built-ins only.
  // It must never block Codex; it spawns sync in the background and exits 0.
  const queueSignalPath = path.join(trackerDir, 'notify.signal');
  const originalPath = path.join(trackerDir, 'codex_notify_original.json');
  const fallbackPkg = packageName || 'vibeusage';
  const trackerBinPath = path.join(trackerDir, 'app', 'bin', 'tracker.js');

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
const codeOriginalPath = ${JSON.stringify(path.join(trackerDir, 'code_notify_original.json'))};
const trackerBinPath = ${JSON.stringify(trackerBinPath)};
  const depsMarkerPath = path.join(trackerDir, 'app', 'node_modules', '@insforge', 'sdk', 'package.json');
  const configPath = path.join(trackerDir, 'config.json');
const fallbackPkg = ${JSON.stringify(fallbackPkg)};
const selfPath = path.resolve(__filename);
const home = os.homedir();

try {
  fs.mkdirSync(trackerDir, { recursive: true });
  fs.writeFileSync(signalPath, new Date().toISOString(), { encoding: 'utf8' });
} catch (_) {}

// Throttle spawn: at most once per 20 seconds.
try {
    const throttlePath = path.join(trackerDir, 'sync.throttle');
    let deviceToken = process.env.VIBEUSAGE_DEVICE_TOKEN || process.env.VIBESCORE_DEVICE_TOKEN || null;
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
      : source === 'claude' || source === 'opencode' || source === 'gemini'
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

async function detectLocalDashboardUrl() {
  // Dev-only convenience: prefer a local dashboard (if running) so the user sees our own UI first.
  // Vite defaults to 5173, but may auto-increment if the port is taken.
  const hosts = ['127.0.0.1', 'localhost'];
  const ports = [5173, 5174, 5175, 5176, 5177];

  for (const port of ports) {
    for (const host of hosts) {
      const base = `http://${host}:${port}`;
      const ok = await checkUrlReachable(base);
      if (ok) return base;
    }
  }
  return null;
}

async function checkUrlReachable(url) {
  const timeoutMs = 250;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(t);
    return Boolean(res && res.ok);
  } catch (_e) {
    return false;
  }
}

async function probeFile(p) {
  try {
    const st = await fs.stat(p);
    if (st.isFile()) return { exists: true, reason: null };
    return { exists: false, reason: 'not-file' };
  } catch (e) {
    if (e?.code === 'ENOENT' || e?.code === 'ENOTDIR') return { exists: false, reason: 'missing' };
    if (e?.code === 'EACCES' || e?.code === 'EPERM') return { exists: false, reason: 'permission-denied' };
    return { exists: false, reason: 'error', code: e?.code || 'unknown' };
  }
}

async function isDir(p) {
  try {
    const st = await fs.stat(p);
    return st.isDirectory();
  } catch (_e) {
    return false;
  }
}

async function installLocalTrackerApp({ appDir }) {
  // Copy the current package's runtime (bin + src) into ~/.vibeusage so notify can run sync without npx.
  const packageRoot = path.resolve(__dirname, '../..');
  const srcFrom = path.join(packageRoot, 'src');
  const binFrom = path.join(packageRoot, 'bin', 'tracker.js');
  const nodeModulesFrom = path.join(packageRoot, 'node_modules');

  const srcTo = path.join(appDir, 'src');
  const binToDir = path.join(appDir, 'bin');
  const binTo = path.join(binToDir, 'tracker.js');
  const nodeModulesTo = path.join(appDir, 'node_modules');

  await fs.rm(appDir, { recursive: true, force: true }).catch(() => {});
  await ensureDir(appDir);
  await fs.cp(srcFrom, srcTo, { recursive: true });
  await ensureDir(binToDir);
  await fs.copyFile(binFrom, binTo);
  await fs.chmod(binTo, 0o755).catch(() => {});
  await copyRuntimeDependencies({ from: nodeModulesFrom, to: nodeModulesTo });
}

function spawnInitSync({ trackerBinPath, packageName }) {
  const fallbackPkg = packageName || 'vibeusage';
  const argv = ['sync', '--drain'];
  const hasLocalRuntime = typeof trackerBinPath === 'string' && fssync.existsSync(trackerBinPath);
  const cmd = hasLocalRuntime
    ? [process.execPath, trackerBinPath, ...argv]
    : ['npx', '--yes', fallbackPkg, ...argv];
  const child = cp.spawn(cmd[0], cmd.slice(1), {
    detached: true,
    stdio: 'ignore',
    env: process.env
  });
  child.on('error', (err) => {
    const msg = err && err.message ? err.message : 'unknown error';
    const detail = isDebugEnabled() ? ` (${msg})` : '';
    process.stderr.write(`Minor issue: Background sync could not start${detail}.\n`);
    process.stderr.write('Run: npx --yes vibeusage sync\n');
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
  return process.env.VIBEUSAGE_DEBUG === '1' || process.env.VIBESCORE_DEBUG === '1';
}
