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
  loadCodexNotifyOriginal,
  upsertEveryCodeNotify,
  loadEveryCodeNotifyOriginal
} = require('../lib/codex-config');
const { upsertClaudeHook, buildClaudeHookCommand } = require('../lib/claude-config');
const {
  resolveGeminiConfigDir,
  resolveGeminiSettingsPath,
  buildGeminiHookCommand,
  upsertGeminiHook
} = require('../lib/gemini-config');
const { resolveOpencodeConfigDir, upsertOpencodePlugin } = require('../lib/opencode-config');
const { beginBrowserAuth, openInBrowser } = require('../lib/browser-auth');
const {
  issueDeviceTokenWithPassword,
  issueDeviceTokenWithAccessToken,
  issueDeviceTokenWithLinkCode
} = require('../lib/insforge');

async function cmdInit(argv) {
  const opts = parseArgs(argv);
  const home = os.homedir();

  const rootDir = path.join(home, '.vibescore');
  const trackerDir = path.join(rootDir, 'tracker');
  const binDir = path.join(rootDir, 'bin');

  await ensureDir(trackerDir);
  await ensureDir(binDir);

  const configPath = path.join(trackerDir, 'config.json');
  const notifyOriginalPath = path.join(trackerDir, 'codex_notify_original.json');
  const linkCodeStatePath = path.join(trackerDir, 'link_code_state.json');

  const baseUrl = opts.baseUrl || process.env.VIBESCORE_INSFORGE_BASE_URL || 'https://5tmappuk.us-east.insforge.app';
  let dashboardUrl = opts.dashboardUrl || process.env.VIBESCORE_DASHBOARD_URL || null;
  const notifyPath = path.join(binDir, 'notify.cjs');
  const appDir = path.join(trackerDir, 'app');
  const trackerBinPath = path.join(appDir, 'bin', 'tracker.js');

  process.stdout.write(
    [
      'Starting VibeScore setup:',
      'Open-source. No conversation uploads. GitHub: https://github.com/victorGPT/vibescore',
      '- Install local runtime + hooks.',
      '- Browser sign-in runs last if needed.',
      ''
    ].join('\n')
  );

  const existingConfig = await readJson(configPath);
  const deviceTokenFromEnv = process.env.VIBESCORE_DEVICE_TOKEN || null;

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

  // Install notify handler (non-blocking; chains the previous notify if present).
  await writeFileAtomic(
    notifyPath,
    buildNotifyHandler({ trackerDir, trackerBinPath, packageName: '@vibescore/tracker' })
  );
  await fs.chmod(notifyPath, 0o755).catch(() => {});

  // Configure Codex notify hook.
  const codexHome = process.env.CODEX_HOME || path.join(home, '.codex');
  const codexConfigPath = path.join(codexHome, 'config.toml');
  const codeHome = process.env.CODE_HOME || path.join(home, '.code');
  const codeConfigPath = path.join(codeHome, 'config.toml');
  const notifyCmd = ['/usr/bin/env', 'node', notifyPath];
  const codexProbe = await probeFile(codexConfigPath);
  const codexConfigExists = codexProbe.exists;
  let result = null;
  let chained = null;
  if (codexConfigExists) {
    result = await upsertCodexNotify({
      codexConfigPath,
      notifyCmd,
      notifyOriginalPath
    });
    chained = await loadCodexNotifyOriginal(notifyOriginalPath);
  }
  const codeNotifyOriginalPath = path.join(trackerDir, 'code_notify_original.json');
  const codeProbe = await probeFile(codeConfigPath);
  const codeConfigExists = codeProbe.exists;
  let codeResult = null;
  let codeChained = null;
  if (codeConfigExists) {
    const codeNotifyCmd = ['/usr/bin/env', 'node', notifyPath, '--source=every-code'];
    codeResult = await upsertEveryCodeNotify({
      codeConfigPath,
      notifyCmd: codeNotifyCmd,
      notifyOriginalPath: codeNotifyOriginalPath
    });
    codeChained = await loadEveryCodeNotifyOriginal(codeNotifyOriginalPath);
  }

  const claudeDir = path.join(home, '.claude');
  const claudeSettingsPath = path.join(claudeDir, 'settings.json');
  const claudeDirExists = await isDir(claudeDir);
  let claudeResult = null;
  if (claudeDirExists) {
    const claudeHookCommand = buildClaudeHookCommand(notifyPath);
    claudeResult = await upsertClaudeHook({
      settingsPath: claudeSettingsPath,
      hookCommand: claudeHookCommand
    });
  }

  const geminiConfigDir = resolveGeminiConfigDir({ home, env: process.env });
  const geminiConfigExists = await isDir(geminiConfigDir);
  const geminiSettingsPath = resolveGeminiSettingsPath({ configDir: geminiConfigDir });
  let geminiResult = null;
  if (geminiConfigExists) {
    const geminiHookCommand = buildGeminiHookCommand(notifyPath);
    geminiResult = await upsertGeminiHook({
      settingsPath: geminiSettingsPath,
      hookCommand: geminiHookCommand
    });
  }

  const opencodeConfigDir = resolveOpencodeConfigDir({ home, env: process.env });
  const opencodeResult = await upsertOpencodePlugin({
    configDir: opencodeConfigDir,
    notifyPath
  });

  process.stdout.write(
    [
      'Local setup done:',
      `- Config: ${configPath}`,
      `- Notify handler: ${notifyPath}`,
      codexConfigExists
        ? `- Codex config: ${codexConfigPath}`
        : `- Codex notify: skipped (${renderProbeSkip(codexConfigPath, codexProbe)})`,
      codexConfigExists
        ? result?.changed
          ? '- Codex notify: updated'
          : '- Codex notify: set'
        : null,
      codexConfigExists ? (chained ? '- Codex notify: chained (kept original)' : '- Codex notify: no original') : null,
      codeConfigExists
        ? `- Every Code config: ${codeConfigPath}`
        : `- Every Code notify: skipped (${renderProbeSkip(codeConfigPath, codeProbe)})`,
      codeConfigExists && codeResult
        ? codeResult.changed
          ? '- Every Code notify: updated'
          : '- Every Code notify: set'
        : null,
      codeConfigExists
        ? codeChained
          ? '- Every Code notify: chained (kept original)'
          : '- Every Code notify: no original'
        : null,
      claudeDirExists
        ? claudeResult?.changed
          ? `- Claude hooks: updated (${claudeSettingsPath})`
          : `- Claude hooks: set (${claudeSettingsPath})`
        : '- Claude hooks: skipped (~/.claude not found)',
      geminiConfigExists
        ? geminiResult?.changed
          ? `- Gemini hooks: updated (${geminiSettingsPath})`
          : `- Gemini hooks: set (${geminiSettingsPath})`
        : `- Gemini hooks: skipped (${geminiConfigDir} not found)`,
      opencodeResult?.skippedReason === 'config-missing'
        ? '- Opencode plugin: skipped (config dir missing)'
        : opencodeResult?.changed
          ? `- Opencode plugin: updated (${opencodeConfigDir})`
          : `- Opencode plugin: set (${opencodeConfigDir})`,
      pendingBrowserAuth
        ? '- Account: pending (browser sign-in last)'
        : deviceToken
          ? `- Account: linked (token saved: ${maskSecret(deviceToken)})`
          : '- Account: not set (set VIBESCORE_DEVICE_TOKEN then re-run init)',
      ''
    ].join('\n')
  );

  if (pendingBrowserAuth) {
    const deviceName = opts.deviceName || os.hostname();
    if (!dashboardUrl) dashboardUrl = await detectLocalDashboardUrl();
    const flow = await beginBrowserAuth({ baseUrl, dashboardUrl, timeoutMs: 10 * 60_000, open: false });
    process.stdout.write(
      [
        '',
        'Next: link your account (last step).',
        `- Open: ${flow.authUrl}`,
        '- Sign in/up, then return.',
        "- If it doesn't open, copy the link.",
        '- After linking, wait ~2 minutes for first sync.',
        ''
      ].join('\n')
    );
    if (!opts.noOpen) {
      await sleep(5000);
      openInBrowser(flow.authUrl);
    }
    const callback = await flow.waitForCallback();
    const issued = await issueDeviceTokenWithAccessToken({ baseUrl, accessToken: callback.accessToken, deviceName });
    deviceToken = issued.token;
    deviceId = issued.deviceId;
    await writeJson(configPath, { baseUrl, deviceToken, deviceId, installedAt });
    await chmod600IfPossible(configPath);
    process.stdout.write(
      ['', 'Account linked.', `- Token saved: ${maskSecret(deviceToken)}`, '- Initial sync runs in background.', ''].join('\n')
    );
  }

  try {
    spawnInitSync({ trackerBinPath, packageName: '@vibescore/tracker' });
  } catch (err) {
    const msg = err && err.message ? err.message : 'unknown error';
    process.stderr.write(`Initial sync spawn failed: ${msg}\n`);
  }
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
    noOpen: false
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
    else throw new Error(`Unknown option: ${a}`);
  }
  return out;
}

function maskSecret(s) {
  if (typeof s !== 'string' || s.length < 8) return '***';
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
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
  const fallbackPkg = packageName || '@vibescore/tracker';
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
    let deviceToken = process.env.VIBESCORE_DEVICE_TOKEN || null;
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

async function isFile(p) {
  try {
    const st = await fs.stat(p);
    return st.isFile();
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

function renderProbeSkip(pathname, probe) {
  if (!probe || probe.reason === 'missing') return `${pathname} not found`;
  if (probe.reason === 'not-file') return `${pathname} is not a file`;
  if (probe.reason === 'permission-denied') return `permission denied: ${pathname}`;
  const code = probe.code ? ` (${probe.code})` : '';
  return `unavailable: ${pathname}${code}`;
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
  // Copy the current package's runtime (bin + src) into ~/.vibescore so notify can run sync without npx.
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
  const fallbackPkg = packageName || '@vibescore/tracker';
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
    process.stderr.write(`Initial sync spawn failed: ${msg}\n`);
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
