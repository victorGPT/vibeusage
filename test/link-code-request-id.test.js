const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const { test } = require('node:test');

function loadInitWithStubbedInsforge(stub) {
  const insforgePath = path.join(__dirname, '..', 'src', 'lib', 'insforge.js');
  const initPath = path.join(__dirname, '..', 'src', 'commands', 'init.js');
  delete require.cache[insforgePath];
  delete require.cache[initPath];
  require.cache[insforgePath] = {
    id: insforgePath,
    filename: insforgePath,
    loaded: true,
    exports: stub
  };
  return require(initPath);
}

test('init reuses link code request_id across retries', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-link-code-'));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevToken = process.env.VIBESCORE_DEVICE_TOKEN;
  const prevWrite = process.stdout.write;

  const calls = [];
  let shouldFail = true;

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, '.codex');
    delete process.env.VIBESCORE_DEVICE_TOKEN;
    await fs.mkdir(process.env.CODEX_HOME, { recursive: true });
    const codexConfigPath = path.join(process.env.CODEX_HOME, 'config.toml');
    await fs.writeFile(codexConfigPath, '# empty\n', 'utf8');

    const stub = {
      issueDeviceTokenWithLinkCode: async ({ requestId }) => {
        calls.push(requestId);
        if (shouldFail) {
          shouldFail = false;
          throw new Error('network');
        }
        return { token: 'token', deviceId: 'device' };
      },
      issueDeviceTokenWithPassword: async () => {
        throw new Error('unexpected');
      },
      issueDeviceTokenWithAccessToken: async () => {
        throw new Error('unexpected');
      }
    };

    const { cmdInit } = loadInitWithStubbedInsforge(stub);
    process.stdout.write = () => true;

    const linkCode = 'link_code_retry';
    const linkCodeHash = crypto.createHash('sha256').update(linkCode).digest('hex');
    const linkStatePath = path.join(tmp, '.vibescore', 'tracker', 'link_code_state.json');

    await assert.rejects(
      () =>
        cmdInit([
          '--link-code',
          linkCode,
          '--no-open',
          '--base-url',
          'https://example.invalid'
        ]),
      /network/
    );

    const stateRaw = await fs.readFile(linkStatePath, 'utf8');
    const state = JSON.parse(stateRaw);
    assert.equal(state.linkCodeHash, linkCodeHash);
    assert.ok(typeof state.requestId === 'string' && state.requestId.length > 0);

    await cmdInit([
      '--link-code',
      linkCode,
      '--no-open',
      '--base-url',
      'https://example.invalid'
    ]);

    assert.equal(calls.length, 2);
    assert.equal(calls[0], calls[1]);

    await assert.rejects(fs.stat(linkStatePath), /ENOENT/);
  } finally {
    process.stdout.write = prevWrite;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    if (prevToken === undefined) delete process.env.VIBESCORE_DEVICE_TOKEN;
    else process.env.VIBESCORE_DEVICE_TOKEN = prevToken;
    await fs.rm(tmp, { recursive: true, force: true });

    const insforgePath = path.join(__dirname, '..', 'src', 'lib', 'insforge.js');
    const initPath = path.join(__dirname, '..', 'src', 'commands', 'init.js');
    delete require.cache[insforgePath];
    delete require.cache[initPath];
  }
});
