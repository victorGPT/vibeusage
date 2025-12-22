#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const COPY_REL = 'dashboard/src/content/copy.csv';
const COPY_PATH = path.join(ROOT, 'dashboard', 'src', 'content', 'copy.csv');
const REQUIRED_COLUMNS = ['key', 'module', 'page', 'component', 'slot', 'text'];

function printUsage() {
  console.log(`Copy registry sync (origin/main)

Usage:
  node scripts/copy-sync.cjs pull [--dry-run|--apply]
  node scripts/copy-sync.cjs push [--dry-run|--confirm] [--push-remote]

Defaults:
  pull: --dry-run
  push: --dry-run

Flags:
  --dry-run     Show diff only, no write/push
  --apply       Apply pull (write local copy.csv)
  --confirm     Confirm push (required for any push)
  --push-remote Push to origin/main (requires --confirm)
  --help        Show help

Notes:
  - push --confirm will auto-commit copy.csv if it is the only dirty file
  - push aborts when other files are dirty
`);
}

function runGit(args, options = {}) {
  const res = spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    ...options
  });
  if (res.error) {
    throw res.error;
  }
  return res;
}

function requireGitSuccess(res, context) {
  if (res.status !== 0) {
    const msg = res.stderr?.trim() || res.stdout?.trim() || 'Unknown git error';
    throw new Error(`${context}: ${msg}`);
  }
}

function readSourceCsv() {
  const refs = ['origin/main', 'main'];
  for (const ref of refs) {
    const res = runGit(['show', `${ref}:${COPY_REL}`]);
    if (res.status === 0) {
      return { ref, content: res.stdout };
    }
  }
  throw new Error(`Unable to read ${COPY_REL} from origin/main or main.`);
}

function parseCsv(raw) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = raw[i + 1];
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (ch === '\n') {
      row.push(field);
      field = '';
      if (!row.every((cell) => String(cell).trim() === '')) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    if (ch === '\r') {
      continue;
    }

    field += ch;
  }

  row.push(field);
  if (!row.every((cell) => String(cell).trim() === '')) {
    rows.push(row);
  }

  return rows;
}

function ensureSchema(raw, label) {
  const rows = parseCsv(raw || '');
  if (!rows.length) {
    throw new Error(`${label} copy registry is empty.`);
  }
  const header = rows[0].map((cell) => String(cell).trim());
  const missing = REQUIRED_COLUMNS.filter((col) => !header.includes(col));
  if (missing.length) {
    throw new Error(`${label} copy registry missing columns: ${missing.join(', ')}`);
  }
}

function ensureCleanTree(actionLabel) {
  const res = runGit(['status', '--porcelain']);
  requireGitSuccess(res, 'git status');
  if (res.stdout.trim().length > 0) {
    throw new Error(`Working tree is not clean; aborting ${actionLabel}.`);
  }
}

function listDirtyPaths() {
  const res = runGit(['status', '--porcelain']);
  requireGitSuccess(res, 'git status');
  const lines = res.stdout.split('\n').filter(Boolean);
  return lines.map((line) => {
    let entry = line.slice(3).trim();
    if (entry.includes(' -> ')) {
      entry = entry.split(' -> ').pop();
    }
    return entry;
  });
}

function ensureOnlyCopyChanges() {
  const dirtyPaths = listDirtyPaths();
  const blocked = dirtyPaths.filter((file) => file !== COPY_REL);
  if (blocked.length > 0) {
    throw new Error(`Working tree has changes outside ${COPY_REL}: ${blocked.join(', ')}`);
  }
  return dirtyPaths.length > 0;
}

function autoCommitCopy() {
  const addRes = runGit(['add', '--', COPY_REL]);
  requireGitSuccess(addRes, 'git add');

  const commitRes = runGit(['commit', '-m', 'chore(copy): sync registry']);
  if (commitRes.status !== 0) {
    const output = `${commitRes.stderr || ''}${commitRes.stdout || ''}`.trim();
    if (output.includes('nothing to commit')) {
      return false;
    }
    throw new Error(`git commit failed: ${output || 'unknown error'}`);
  }
  return true;
}

function showDiffForPull(sourceContent) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-sync-'));
  const sourcePath = path.join(tempDir, 'copy.csv');
  const localExists = fs.existsSync(COPY_PATH);
  const localPath = localExists ? COPY_PATH : path.join(tempDir, 'copy.csv.local');

  try {
    fs.writeFileSync(sourcePath, sourceContent, 'utf8');
    if (!localExists) {
      fs.writeFileSync(localPath, '', 'utf8');
    }

    const res = runGit(['diff', '--no-index', '--color=always', localPath, sourcePath]);
    if (res.status > 1) {
      const msg = res.stderr?.trim() || 'Failed to generate diff.';
      throw new Error(msg);
    }

    if (res.stdout.trim().length === 0) {
      console.log('No differences found.');
    } else {
      process.stdout.write(res.stdout);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function showDiffForPush(ref) {
  const res = runGit(['diff', '--color=always', ref, '--', COPY_REL]);
  if (res.status > 1) {
    const msg = res.stderr?.trim() || 'Failed to generate diff.';
    throw new Error(msg);
  }

  if (res.stdout.trim().length === 0) {
    console.log('No differences found.');
    return false;
  }

  process.stdout.write(res.stdout);
  return true;
}

function runValidation() {
  const res = spawnSync('node', ['scripts/validate-copy-registry.cjs'], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  if (res.status !== 0) {
    const msg = res.stderr?.trim() || res.stdout?.trim() || 'Copy registry validation failed.';
    throw new Error(msg);
  }
  return res.stdout;
}

function backupLocalCopy() {
  if (!fs.existsSync(COPY_PATH)) {
    return null;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${COPY_PATH}.bak-${stamp}`;
  fs.copyFileSync(COPY_PATH, backupPath);
  return backupPath;
}

function getCurrentBranch() {
  const res = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  requireGitSuccess(res, 'git rev-parse');
  return res.stdout.trim();
}

function ensureNotBehind(ref) {
  const res = runGit(['rev-list', '--left-right', '--count', `${ref}...HEAD`]);
  requireGitSuccess(res, 'git rev-list');
  const parts = res.stdout.trim().split(/\s+/).map((value) => Number(value));
  const behind = parts[0] || 0;
  const ahead = parts[1] || 0;
  if (behind > 0) {
    throw new Error(`Local branch is behind ${ref} by ${behind} commit(s).`);
  }
  return { ahead, behind };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  const command = args[0];
  const flags = new Set(args.slice(1));

  if (!['pull', 'push'].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }

  if (command === 'pull') {
    const apply = flags.has('--apply');
    const dryRun = flags.has('--dry-run') || !apply;

    const source = readSourceCsv();
    console.log(`Source of truth: ${source.ref}:${COPY_REL}`);
    ensureSchema(source.content, 'Source');
    showDiffForPull(source.content);

    if (dryRun) {
      console.log('Dry-run: no changes written. Use --apply to write.');
      return;
    }

    ensureCleanTree('pull --apply');
    const backupPath = backupLocalCopy();
    fs.writeFileSync(COPY_PATH, source.content, 'utf8');

    console.log(`Updated ${COPY_PATH}`);
    if (backupPath) {
      console.log(`Backup created: ${backupPath}`);
    }
    return;
  }

  if (command === 'push') {
    const confirm = flags.has('--confirm');
    const dryRun = flags.has('--dry-run') || !confirm;
    const pushRemote = flags.has('--push-remote');

    if (pushRemote && !confirm) {
      throw new Error('Use --confirm to allow remote push.');
    }

    const source = readSourceCsv();
    console.log(`Source of truth: ${source.ref}:${COPY_REL}`);
    runValidation();

    const hasDiff = showDiffForPush(source.ref);

    if (dryRun) {
      console.log('Dry-run: no push performed. Use --confirm to proceed.');
      return;
    }

    if (!hasDiff) {
      console.log('No copy registry changes to push.');
      return;
    }

    const hasLocalChanges = ensureOnlyCopyChanges();
    if (hasLocalChanges) {
      const committed = autoCommitCopy();
      if (committed) {
        console.log('Auto-committed copy registry changes.');
      }
    }

    if (!pushRemote) {
      console.log('Confirmed. No remote push requested.');
      return;
    }

    if (source.ref !== 'origin/main') {
      throw new Error('origin/main is not available; remote push is disabled.');
    }

    const branch = getCurrentBranch();
    if (branch !== 'main') {
      throw new Error(`Remote push requires branch main (current: ${branch}).`);
    }

    const { ahead } = ensureNotBehind('origin/main');
    if (ahead === 0) {
      console.log('No commits ahead of origin/main. Nothing to push.');
      return;
    }

    const res = runGit(['push', 'origin', 'main']);
    requireGitSuccess(res, 'git push');
    process.stdout.write(res.stdout || 'Remote push completed.\n');
    return;
  }
}

try {
  main();
} catch (err) {
  console.error(`[copy-sync] ${err.message}`);
  process.exit(1);
}
