const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { test } = require('node:test');

function stripAnsi(text) {
  return String(text || '').replace(/\x1b\[[0-9;]*m/g, '');
}

function loadInitWithStubs() {
  const browserAuthPath = path.join(__dirname, '..', 'src', 'lib', 'browser-auth.js');
  const insforgePath = path.join(__dirname, '..', 'src', 'lib', 'insforge.js');
  const initPath = path.join(__dirname, '..', 'src', 'commands', 'init.js');

  delete require.cache[browserAuthPath];
  delete require.cache[insforgePath];
  delete require.cache[initPath];

  require.cache[browserAuthPath] = {
    id: browserAuthPath,
    filename: browserAuthPath,
    loaded: true,
    exports: {
      beginBrowserAuth: async () => ({
        authUrl: 'https://auth.example/cli',
        waitForCallback: async () => ({ accessToken: 'access-token' })
      }),
      openInBrowser: () => {}
    }
  };

  require.cache[insforgePath] = {
    id: insforgePath,
    filename: insforgePath,
    loaded: true,
    exports: {
      issueDeviceTokenWithAccessToken: async () => ({ token: 'device-token', deviceId: 'device-123' }),
      issueDeviceTokenWithPassword: async () => {
        throw new Error('unexpected');
      },
      issueDeviceTokenWithLinkCode: async () => {
        throw new Error('unexpected');
      }
    }
  };

  return require(initPath);
}

test('init emits local report then auth transition and success url', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-init-flow-'));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevDashboard = process.env.VIBESCORE_DASHBOARD_URL;
  const prevWrite = process.stdout.write;

  let output = '';

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, '.codex');
    process.env.VIBESCORE_DASHBOARD_URL = 'https://dashboard.example';

    await fs.mkdir(process.env.CODEX_HOME, { recursive: true });
    await fs.writeFile(path.join(process.env.CODEX_HOME, 'config.toml'), '# empty\n', 'utf8');

    process.stdout.write = (chunk) => {
      output += String(chunk || '');
      return true;
    };

    const { cmdInit } = loadInitWithStubs();
    await cmdInit(['--yes', '--no-open', '--base-url', 'https://example.invalid']);

    const clean = stripAnsi(output);
    const localIdx = clean.indexOf('Local configuration complete.');
    const statusIdx = clean.indexOf('Integration Status:');
    const summaryIdx = clean.indexOf('Codex CLI');
    const nextIdx = clean.indexOf('Next: Registering device...');
    const openIdx = clean.indexOf('Open the link below');
    const successIdx = clean.indexOf('You are all set!');

    assert.ok(localIdx !== -1, 'expected local completion line');
    assert.ok(statusIdx !== -1, 'expected status header');
    assert.ok(summaryIdx !== -1, 'expected summary line');
    assert.ok(nextIdx !== -1, 'expected transition line');
    assert.ok(openIdx !== -1, 'expected auth instruction');
    assert.ok(successIdx !== -1, 'expected success box');
    assert.ok(localIdx < statusIdx && statusIdx < summaryIdx && summaryIdx < nextIdx, 'expected ordered flow');
    assert.ok(clean.includes('View your stats at: https://dashboard.example'));
    assert.ok(!clean.includes('Device ID:'), 'expected no device id');
    assert.ok(!clean.includes('VibeScore is now running in the background.'), 'expected background line removed');
  } finally {
    process.stdout.write = prevWrite;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    if (prevDashboard === undefined) delete process.env.VIBESCORE_DASHBOARD_URL;
    else process.env.VIBESCORE_DASHBOARD_URL = prevDashboard;
    await fs.rm(tmp, { recursive: true, force: true });

    const browserAuthPath = path.join(__dirname, '..', 'src', 'lib', 'browser-auth.js');
    const insforgePath = path.join(__dirname, '..', 'src', 'lib', 'insforge.js');
    const initPath = path.join(__dirname, '..', 'src', 'commands', 'init.js');
    delete require.cache[browserAuthPath];
    delete require.cache[insforgePath];
    delete require.cache[initPath];
  }
});
