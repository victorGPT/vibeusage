const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { test } = require('node:test');

const { cmdSync } = require('../src/commands/sync');

test('sync reads Claude logs from CLAUDE_HOME', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-claude-home-'));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevClaudeHome = process.env.CLAUDE_HOME;

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, '.codex');
    process.env.CLAUDE_HOME = path.join(tmp, '.claude-alt');

    const projectsDir = path.join(process.env.CLAUDE_HOME, 'projects', 'demo');
    await fs.mkdir(projectsDir, { recursive: true });

    const logPath = path.join(projectsDir, 'session.jsonl');
    await fs.writeFile(
      logPath,
      JSON.stringify({
        timestamp: '2025-12-25T01:00:00.000Z',
        message: {
          model: 'claude-3.5-sonnet',
          usage: { input_tokens: 10, output_tokens: 5 }
        }
      }) + '\n',
      'utf8'
    );

    await cmdSync([]);

    const cursorsPath = path.join(tmp, '.vibescore', 'tracker', 'cursors.json');
    const cursors = JSON.parse(await fs.readFile(cursorsPath, 'utf8'));
    const files = cursors?.files || {};
    assert.ok(Object.prototype.hasOwnProperty.call(files, logPath));
  } finally {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    if (prevClaudeHome === undefined) delete process.env.CLAUDE_HOME;
    else process.env.CLAUDE_HOME = prevClaudeHome;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
