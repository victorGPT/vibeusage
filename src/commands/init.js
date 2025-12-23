const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');

const { ensureDir, writeFileAtomic, readJson, writeJson, chmod600IfPossible } = require('../lib/fs');
const { prompt, promptHidden } = require('../lib/prompt');
const { upsertCodexNotify, loadCodexNotifyOriginal } = require('../lib/codex-config');
const { beginBrowserAuth } = require('../lib/browser-auth');
const { issueDeviceTokenWithPassword, issueDeviceTokenWithAccessToken } = require('../lib/insforge');
const { cmdSync } = require('./sync');

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

  const baseUrl = opts.baseUrl || process.env.VIBESCORE_INSFORGE_BASE_URL || 'https://5tmappuk.us-east.insforge.app';
  let dashboardUrl = opts.dashboardUrl || process.env.VIBESCORE_DASHBOARD_URL || null;
  const notifyPath = path.join(binDir, 'notify.cjs');
  const appDir = path.join(trackerDir, 'app');
  const trackerBinPath = path.join(appDir, 'bin', 'tracker.js');

  const existingConfig = await readJson(configPath);
  const deviceTokenFromEnv = process.env.VIBESCORE_DEVICE_TOKEN || null;

  let deviceToken = deviceTokenFromEnv || existingConfig?.deviceToken || null;
  let deviceId = existingConfig?.deviceId || null;

  await installLocalTrackerApp({ appDir });

  if (!deviceToken && !opts.noAuth) {
    const deviceName = opts.deviceName || os.hostname();

    if (opts.email || opts.password) {
      const email = opts.email || (await prompt('Email: '));
      const password = opts.password || (await promptHidden('Password: '));
      const issued = await issueDeviceTokenWithPassword({ baseUrl, email, password, deviceName });
      deviceToken = issued.token;
      deviceId = issued.deviceId;
    } else {
      if (!dashboardUrl) dashboardUrl = await detectLocalDashboardUrl();
      const flow = await beginBrowserAuth({ baseUrl, dashboardUrl, timeoutMs: 10 * 60_000, open: !opts.noOpen });
      process.stdout.write(
        [
          '',
          'Connect your account:',
          `- Open: ${flow.authUrl}`,
          '- Finish sign in/up in your browser, then come back here.',
          ''
        ].join('\n')
      );
      const callback = await flow.waitForCallback();
      const issued = await issueDeviceTokenWithAccessToken({ baseUrl, accessToken: callback.accessToken, deviceName });
      deviceToken = issued.token;
      deviceId = issued.deviceId;
    }
  }

  const config = {
    baseUrl,
    deviceToken,
    deviceId,
    installedAt: existingConfig?.installedAt || new Date().toISOString()
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
  const codexConfigPath = path.join(home, '.codex', 'config.toml');
  const notifyCmd = ['/usr/bin/env', 'node', notifyPath];
  const result = await upsertCodexNotify({
    codexConfigPath,
    notifyCmd,
    notifyOriginalPath
  });

  const chained = await loadCodexNotifyOriginal(notifyOriginalPath);

  process.stdout.write(
    [
      'Installed:',
      `- Tracker config: ${configPath}`,
      `- Notify handler: ${notifyPath}`,
      `- Codex config: ${codexConfigPath}`,
      result.changed ? '- Codex notify: updated' : '- Codex notify: already set',
      chained ? '- Codex notify: chained (original preserved)' : '- Codex notify: no original',
      deviceToken ? `- Device token: stored (${maskSecret(deviceToken)})` : '- Device token: not configured (set VIBESCORE_DEVICE_TOKEN and re-run init)',
      ''
    ].join('\n')
  );

  try {
    await cmdSync([]);
  } catch (err) {
    const msg = err && err.message ? err.message : 'unknown error';
    process.stderr.write(`Initial sync failed: ${msg}\n`);
  }
}

function parseArgs(argv) {
  const out = {
    baseUrl: null,
    dashboardUrl: null,
    email: null,
    password: null,
    deviceName: null,
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

const payload = process.argv[2] || '';
const trackerDir = ${JSON.stringify(trackerDir)};
const signalPath = ${JSON.stringify(queueSignalPath)};
const originalPath = ${JSON.stringify(originalPath)};
const trackerBinPath = ${JSON.stringify(trackerBinPath)};
const fallbackPkg = ${JSON.stringify(fallbackPkg)};

try {
  fs.mkdirSync(trackerDir, { recursive: true });
  fs.writeFileSync(signalPath, new Date().toISOString(), { encoding: 'utf8' });
} catch (_) {}

// Throttle spawn: at most once per 20 seconds.
try {
  const throttlePath = path.join(trackerDir, 'sync.throttle');
  const now = Date.now();
  let last = 0;
  try { last = Number(fs.readFileSync(throttlePath, 'utf8')) || 0; } catch (_) {}
  if (now - last > 20_000) {
    try { fs.writeFileSync(throttlePath, String(now), 'utf8'); } catch (_) {}
    if (fs.existsSync(trackerBinPath)) {
      spawnDetached([process.execPath, trackerBinPath, 'sync', '--auto', '--from-notify']);
    } else {
      spawnDetached(['npx', '--yes', fallbackPkg, 'sync', '--auto', '--from-notify']);
    }
  }
} catch (_) {}

// Chain the original Codex notify if present.
try {
  const original = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
  const cmd = Array.isArray(original?.notify) ? original.notify : null;
  if (cmd && cmd.length > 0) {
    const args = cmd.slice(1);
    args.push(payload);
    spawnDetached([cmd[0], ...args]);
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

async function installLocalTrackerApp({ appDir }) {
  // Copy the current package's runtime (bin + src) into ~/.vibescore so notify can run sync without npx.
  const packageRoot = path.resolve(__dirname, '../..');
  const srcFrom = path.join(packageRoot, 'src');
  const binFrom = path.join(packageRoot, 'bin', 'tracker.js');

  const srcTo = path.join(appDir, 'src');
  const binToDir = path.join(appDir, 'bin');
  const binTo = path.join(binToDir, 'tracker.js');

  await fs.rm(appDir, { recursive: true, force: true }).catch(() => {});
  await ensureDir(appDir);
  await fs.cp(srcFrom, srcTo, { recursive: true });
  await ensureDir(binToDir);
  await fs.copyFile(binFrom, binTo);
  await fs.chmod(binTo, 0o755).catch(() => {});
}
