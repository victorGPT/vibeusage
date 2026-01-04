const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { test } = require('node:test');

const { cmdStatus } = require('../src/commands/status');

test('status prints last upload timestamps from upload.throttle.json', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibeusage-status-'));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevWrite = process.stdout.write;

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, '.codex');

    const trackerDir = path.join(tmp, '.vibeusage', 'tracker');
    await fs.mkdir(trackerDir, { recursive: true });
    await fs.mkdir(process.env.CODEX_HOME, { recursive: true });

    await fs.writeFile(
      path.join(process.env.CODEX_HOME, 'config.toml'),
      'notify = [\"/usr/bin/env\", \"node\", \"~/.vibeusage/bin/notify.cjs\"]\n',
      'utf8'
    );

    await fs.writeFile(
      path.join(trackerDir, 'config.json'),
      JSON.stringify({ baseUrl: 'https://example.invalid', deviceToken: 't', deviceId: 'd' }, null, 2) + '\n',
      'utf8'
    );
    await fs.writeFile(path.join(trackerDir, 'cursors.json'), JSON.stringify({ updatedAt: '2025-12-18T00:00:00.000Z' }) + '\n', 'utf8');
    await fs.writeFile(path.join(trackerDir, 'queue.jsonl'), '', 'utf8');
    await fs.writeFile(path.join(trackerDir, 'queue.state.json'), JSON.stringify({ offset: 0 }) + '\n', 'utf8');

    const lastSuccessMs = 1766053145522; // 2025-12-18T10:19:05.522Z
    const nextAllowedAtMs = lastSuccessMs + 1000;
    await fs.writeFile(
      path.join(trackerDir, 'upload.throttle.json'),
      JSON.stringify({ version: 1, lastSuccessMs, nextAllowedAtMs, backoffUntilMs: 0, backoffStep: 0 }, null, 2) + '\n',
      'utf8'
    );

    let out = '';
    process.stdout.write = (chunk, enc, cb) => {
      out += typeof chunk === 'string' ? chunk : chunk.toString(enc || 'utf8');
      if (typeof cb === 'function') cb();
      return true;
    };

    await cmdStatus();

    assert.match(out, /- Last upload: 2025-12-18T10:19:05\.522Z/);
    assert.match(out, /- Next upload after: 2025-12-18T10:19:06\.522Z/);
  } finally {
    process.stdout.write = prevWrite;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('status migrates legacy tracker directory when only legacy exists', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibeusage-status-legacy-'));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevWrite = process.stdout.write;

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, '.codex');

    const legacyTrackerDir = path.join(tmp, '.vibescore', 'tracker');
    await fs.mkdir(legacyTrackerDir, { recursive: true });
    await fs.mkdir(process.env.CODEX_HOME, { recursive: true });

    await fs.writeFile(
      path.join(process.env.CODEX_HOME, 'config.toml'),
      'notify = [\"/usr/bin/env\", \"node\", \"~/.vibescore/bin/notify.cjs\"]\n',
      'utf8'
    );

    await fs.writeFile(
      path.join(legacyTrackerDir, 'config.json'),
      JSON.stringify({ baseUrl: 'https://example.invalid', deviceToken: 't', deviceId: 'd' }, null, 2) + '\n',
      'utf8'
    );
    await fs.writeFile(path.join(legacyTrackerDir, 'cursors.json'), JSON.stringify({ updatedAt: '2025-12-18T00:00:00.000Z' }) + '\n', 'utf8');
    await fs.writeFile(path.join(legacyTrackerDir, 'queue.jsonl'), '', 'utf8');
    await fs.writeFile(path.join(legacyTrackerDir, 'queue.state.json'), JSON.stringify({ offset: 0 }) + '\n', 'utf8');

    const lastSuccessMs = 1766053145522; // 2025-12-18T10:19:05.522Z
    const nextAllowedAtMs = lastSuccessMs + 1000;
    await fs.writeFile(
      path.join(legacyTrackerDir, 'upload.throttle.json'),
      JSON.stringify({ version: 1, lastSuccessMs, nextAllowedAtMs, backoffUntilMs: 0, backoffStep: 0 }, null, 2) + '\n',
      'utf8'
    );

    let out = '';
    process.stdout.write = (chunk, enc, cb) => {
      out += typeof chunk === 'string' ? chunk : chunk.toString(enc || 'utf8');
      if (typeof cb === 'function') cb();
      return true;
    };

    await cmdStatus();

    assert.match(out, /- Last upload: 2025-12-18T10:19:05\.522Z/);
    const newTrackerDir = path.join(tmp, '.vibeusage', 'tracker');
    await assert.doesNotReject(fs.stat(newTrackerDir));
  } finally {
    process.stdout.write = prevWrite;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
