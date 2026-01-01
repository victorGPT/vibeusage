# CLI Init Auth Copy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace post-consent init output with the Local -> Report -> Auth -> Success flow while keeping existing summary list formatting.

**Architecture:** Introduce a dedicated `src/lib/init-flow.js` copy-deck + renderer for post-consent stages. `cmdInit` only orchestrates stages and injects data (summary, auth URL, dashboard URL, device info).

**Tech Stack:** Node.js (CommonJS), node:test, existing CLI utilities in `src/lib/cli-ui.js`.

---

### Task 0: Sync OpenSpec change into branch

**Files:**
- Add: `openspec/changes/2026-01-01-update-cli-init-auth-copy/**`

**Step 1: Copy change directory into worktree**

Run: `cp -R ../openspec/changes/2026-01-01-update-cli-init-auth-copy openspec/changes/`

Expected: directory exists in the branch.

**Step 2: Verify OpenSpec change is valid**

Run: `openspec validate 2026-01-01-update-cli-init-auth-copy --strict`

Expected: PASS.

**Step 3: Commit**

```bash
git add openspec/changes/2026-01-01-update-cli-init-auth-copy
git commit -m "chore: add openspec change for init auth copy"
```

---

### Task 1: Add failing test for post-consent copy flow order

**Files:**
- Create: `test/init-flow-copy.test.js`

**Step 1: Write the failing test**

```js
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { test } = require('node:test');

function stubInit({ tmp }) {
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

function stripAnsi(text) {
  return String(text || '').replace(/\x1b\[[0-9;]*m/g, '');
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

    const { cmdInit } = stubInit({ tmp });
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
```

**Step 2: Run test to verify it fails**

Run: `node --test test/init-flow-copy.test.js`

Expected: FAIL because new copy lines and success URL are not present yet.

**Step 3: Write minimal implementation**

(No code in this step; implementation occurs in Task 2 and Task 3 after red failure.)

**Step 4: Run test to verify it still fails**

Run: `node --test test/init-flow-copy.test.js`

Expected: FAIL (still red).

**Step 5: Commit**

Skip commit until implementation is complete.

---

### Task 2: Add init-flow copy deck + renderer

**Files:**
- Create: `src/lib/init-flow.js`
- Modify: `src/lib/cli-ui.js` (only if new helper is needed; avoid if possible)

**Step 1: Write the failing test**

Use Task 1 failing test as the red baseline.

**Step 2: Run test to verify it fails**

Run: `node --test test/init-flow-copy.test.js`

Expected: FAIL (missing new output lines).

**Step 3: Write minimal implementation**

```js
// src/lib/init-flow.js
'use strict';

const { formatSummaryLine, renderBox, underline } = require('./cli-ui');

const DIVIDER = '----------------------------------------------';

function renderLocalReport({ summary, isDryRun }) {
  const header = isDryRun
    ? 'Dry run complete. Preview only; no changes were applied.'
    : 'Local configuration complete.';
  const lines = [header, '', 'Integration Status:'];
  for (const item of summary || []) lines.push(formatSummaryLine(item));
  process.stdout.write(`${lines.join('\n')}\n`);
}

function renderAuthTransition({ authUrl, canAutoOpen }) {
  const lines = ['', DIVIDER, '', 'Next: Registering device...'];
  if (canAutoOpen) lines.push('Opening your browser to link account...');
  else lines.push('Open the link below to sign in.');
  if (authUrl) lines.push(`If it does not open, visit: ${underline(authUrl)}`);
  lines.push('');
  process.stdout.write(`${lines.join('\n')}\n`);
}

function renderSuccessBox({ configPath, dashboardUrl }) {
  const identityLine = 'Account linked.';
  const lines = [
    'You are all set!',
    '',
    identityLine,
    `Token saved to: ${configPath}`,
    ''
  ];
  if (dashboardUrl) lines.push(`View your stats at: ${dashboardUrl}`);
  lines.push('You can close this terminal window.');
  process.stdout.write(`${renderBox(lines)}\n`);
}

module.exports = { renderLocalReport, renderAuthTransition, renderSuccessBox, DIVIDER };
```

**Step 4: Run test to verify it still fails**

Run: `node --test test/init-flow-copy.test.js`

Expected: FAIL (not wired into init yet).

**Step 5: Commit**

Skip commit until Task 3 is done.

---

### Task 3: Wire init.js to new flow + dashboard URL

**Files:**
- Modify: `src/commands/init.js`

**Step 1: Write the failing test**

Use Task 1 failing test as the red baseline.

**Step 2: Run test to verify it fails**

Run: `node --test test/init-flow-copy.test.js`

Expected: FAIL.

**Step 3: Write minimal implementation**

```js
const { renderLocalReport, renderAuthTransition, renderSuccessBox } = require('../lib/init-flow');

// after setup:
renderLocalReport({ summary: setup.summary, isDryRun: false });
if (setup.pendingBrowserAuth) {
  // use existing auth flow to get authUrl
  renderAuthTransition({ authUrl: flow.authUrl, canAutoOpen });
  // ... existing auth logic
  const successDashboardUrl = dashboardUrl || (await detectLocalDashboardUrl()) || null;
  renderSuccessBox({ deviceId, configPath, dashboardUrl: successDashboardUrl });
} else if (deviceToken) {
  const successDashboardUrl = dashboardUrl || null;
  renderSuccessBox({ deviceId, configPath, dashboardUrl: successDashboardUrl });
}
```

Make sure:
- Output order is Local report -> Transition -> Auth -> Success.
- Keep summary line formatting (`formatSummaryLine`).
- Do not change consent/welcome copy.

**Step 4: Run test to verify it passes**

Run: `node --test test/init-flow-copy.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add test/init-flow-copy.test.js src/lib/init-flow.js src/commands/init.js architecture.canvas

git commit -m "feat: update init post-consent copy flow"
```

---

### Task 4: Regression verification

**Files:**
- None (verification only)

**Step 1: Run focused tests**

Run: `node --test test/init-flow-copy.test.js test/init-dry-run.test.js test/init-spawn-error.test.js`

Expected: PASS.

**Step 2: Commit verification note**

No code changes expected; skip commit.
