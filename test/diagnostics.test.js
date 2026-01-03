const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { test } = require('node:test');

const { cmdDiagnostics } = require('../src/commands/diagnostics');

test('diagnostics redacts device token and home paths', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-diagnostics-'));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevWrite = process.stdout.write;

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, '.codex');

    const trackerDir = path.join(tmp, '.vibescore', 'tracker');
    await fs.mkdir(trackerDir, { recursive: true });
    await fs.mkdir(process.env.CODEX_HOME, { recursive: true });

    const secret = 'super_secret_device_token';
    await fs.writeFile(
      path.join(trackerDir, 'config.json'),
      JSON.stringify(
        {
          baseUrl: 'https://example.invalid',
          deviceToken: secret,
          deviceId: '11111111-1111-1111-1111-111111111111',
          installedAt: '2025-12-19T00:00:00.000Z'
        },
        null,
        2
      ) + '\n',
      'utf8'
    );

    await fs.writeFile(
      path.join(process.env.CODEX_HOME, 'config.toml'),
      `notify = ["/usr/bin/env", "node", "${path.join(tmp, '.vibescore', 'bin', 'notify.cjs')}"]\n`,
      'utf8'
    );

    const retryAtMs = Date.now() + 60_000;
    await fs.writeFile(
      path.join(trackerDir, 'auto.retry.json'),
      JSON.stringify(
        {
          version: 1,
          retryAtMs,
          retryAt: new Date(retryAtMs).toISOString(),
          reason: 'throttled',
          pendingBytes: 123,
          scheduledAt: '2025-12-23T00:00:00.000Z',
          source: 'auto'
        },
        null,
        2
      ) + '\n',
      'utf8'
    );

    let out = '';
    process.stdout.write = (chunk, enc, cb) => {
      out += typeof chunk === 'string' ? chunk : chunk.toString(enc || 'utf8');
      if (typeof cb === 'function') cb();
      return true;
    };

    await cmdDiagnostics([]);

    assert.ok(!out.includes(secret), 'expected device token to be redacted');
    assert.ok(!out.includes(tmp), 'expected home path to be redacted');

    const data = JSON.parse(out);
    assert.equal(data?.config?.device_token, 'set');
    assert.equal(typeof data?.paths?.codex_home, 'string');
    assert.ok(String(data.paths.codex_home).startsWith('~'));
    assert.equal(data?.auto_retry?.reason, 'throttled');
    assert.equal(data?.auto_retry?.pending_bytes, 123);
    assert.equal(data?.auto_retry?.next_retry_at, new Date(retryAtMs).toISOString());
  } finally {
    process.stdout.write = prevWrite;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('diagnostics uses CLAUDE_HOME for claude_config path', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-diagnostics-'));
  const prevHome = process.env.HOME;
  const prevClaudeHome = process.env.CLAUDE_HOME;
  const prevWrite = process.stdout.write;

  try {
    process.env.HOME = tmp;
    process.env.CLAUDE_HOME = path.join(tmp, '.claude-alt');

    let out = '';
    process.stdout.write = (chunk, enc, cb) => {
      out += typeof chunk === 'string' ? chunk : chunk.toString(enc || 'utf8');
      if (typeof cb === 'function') cb();
      return true;
    };

    await cmdDiagnostics([]);

    const data = JSON.parse(out);
    assert.ok(String(data?.paths?.claude_config || '').includes('.claude-alt'));
  } finally {
    process.stdout.write = prevWrite;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevClaudeHome === undefined) delete process.env.CLAUDE_HOME;
    else process.env.CLAUDE_HOME = prevClaudeHome;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
