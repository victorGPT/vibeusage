const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { test } = require('node:test');

const { cmdInit } = require('../src/commands/init');
const { cmdUninstall } = require('../src/commands/uninstall');

test('init then uninstall restores original Codex notify (when pre-existing notify exists)', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-init-uninstall-'));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevToken = process.env.VIBESCORE_DEVICE_TOKEN;
  const prevWrite = process.stdout.write;

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, '.codex');
    delete process.env.VIBESCORE_DEVICE_TOKEN;
    await fs.mkdir(process.env.CODEX_HOME, { recursive: true });

    const codexConfigPath = path.join(process.env.CODEX_HOME, 'config.toml');
    const originalNotify = 'notify = ["echo", "hello"]\n';
    await fs.writeFile(codexConfigPath, originalNotify, 'utf8');

    process.stdout.write = () => true;
    await cmdInit(['--no-auth', '--no-open', '--base-url', 'https://example.invalid']);

    const installed = await fs.readFile(codexConfigPath, 'utf8');
    assert.match(installed, /^notify\s*=\s*\[.+\]\s*$/m);
    assert.ok(!installed.includes('["echo", "hello"]'), 'expected init to override notify');

    const cursorsPath = path.join(tmp, '.vibescore', 'tracker', 'cursors.json');
    const cursors = JSON.parse(await fs.readFile(cursorsPath, 'utf8'));
    assert.ok(typeof cursors.updatedAt === 'string' && cursors.updatedAt.length > 0);

    await cmdUninstall([]);

    const restored = await fs.readFile(codexConfigPath, 'utf8');
    assert.ok(restored.includes('notify = ["echo", "hello"]'), 'expected uninstall to restore original notify');

    const notifyHandlerPath = path.join(tmp, '.vibescore', 'bin', 'notify.cjs');
    await assert.rejects(fs.stat(notifyHandlerPath), /ENOENT/);
  } finally {
    process.stdout.write = prevWrite;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    if (prevToken === undefined) delete process.env.VIBESCORE_DEVICE_TOKEN;
    else process.env.VIBESCORE_DEVICE_TOKEN = prevToken;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('init then uninstall removes notify when none existed', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-init-uninstall-'));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevToken = process.env.VIBESCORE_DEVICE_TOKEN;
  const prevWrite = process.stdout.write;

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, '.codex');
    delete process.env.VIBESCORE_DEVICE_TOKEN;
    await fs.mkdir(process.env.CODEX_HOME, { recursive: true });

    const codexConfigPath = path.join(process.env.CODEX_HOME, 'config.toml');
    await fs.writeFile(codexConfigPath, '# empty\n', 'utf8');

    process.stdout.write = () => true;
    await cmdInit(['--no-auth', '--no-open', '--base-url', 'https://example.invalid']);

    const installed = await fs.readFile(codexConfigPath, 'utf8');
    assert.match(installed, /^notify\s*=\s*\[.+\]\s*$/m);

    await cmdUninstall([]);

    const restored = await fs.readFile(codexConfigPath, 'utf8');
    assert.ok(!/^notify\s*=.*$/m.test(restored), 'expected uninstall to remove notify when none existed');
  } finally {
    process.stdout.write = prevWrite;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    if (prevToken === undefined) delete process.env.VIBESCORE_DEVICE_TOKEN;
    else process.env.VIBESCORE_DEVICE_TOKEN = prevToken;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
