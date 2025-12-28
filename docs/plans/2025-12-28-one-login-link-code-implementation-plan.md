# One-Login Link Code Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a session-bound, 10-minute, single-use link code so CLI `init` can complete without a second login.

**Architecture:** Dashboard issues a short-lived link code tied to the current session; CLI exchanges it for a device token via a dedicated edge function that enforces atomic single-use + idempotency.

**Tech Stack:** Node CLI, React dashboard, InsForge edge functions + Postgres.

### Task 1: Add failing edge function tests for link code init/exchange

**Files:**
- Modify: `test/edge-functions.test.js`

**Step 1: Write the failing test**

```js
const linkCode = 'link_code_test';
const requestId = 'req_123';
// Test: init returns link_code + expires_at
// Test: exchange returns device token and marks used
```

**Step 2: Run test to verify it fails**

Run: `node --test test/edge-functions.test.js`
Expected: FAIL (function not implemented / missing exports)

**Step 3: Write minimal implementation placeholders**

No implementation yet (keep tests failing until Task 2/3).

**Step 4: Run test to verify it still fails**

Run: `node --test test/edge-functions.test.js`
Expected: FAIL

**Step 5: Commit**

```bash
git add test/edge-functions.test.js
git commit -m "test: add link code edge function tests"
```

### Task 2: Add link code schema + exchange RPC

**Files:**
- Create: `openspec/changes/2025-12-28-add-one-login-link-code/sql/001_create_link_codes.sql`
- Create: `openspec/changes/2025-12-28-add-one-login-link-code/sql/002_link_code_exchange_rpc.sql`

**Step 1: Write minimal schema (DDL)**

```sql
create table if not exists public.vibescore_link_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  session_id text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  request_id text,
  created_at timestamptz not null default now()
);
```

**Step 2: Define RPC with atomic exchange**

```sql
-- pseudo signature: exchange_link_code(code_hash, session_id, request_id)
-- verify expires_at >= now(), used_at is null, then mark used + return token
```

**Step 3: Validate SQL changes**

Run: `openspec validate 2025-12-28-add-one-login-link-code --strict`
Expected: PASS

**Step 4: Commit**

```bash
git add openspec/changes/2025-12-28-add-one-login-link-code/sql/001_create_link_codes.sql \
        openspec/changes/2025-12-28-add-one-login-link-code/sql/002_link_code_exchange_rpc.sql

git commit -m "feat: add link code schema and exchange rpc"
```

### Task 3: Implement edge functions (init + exchange)

**Files:**
- Create: `insforge-src/functions/vibescore-link-code-init.js`
- Create: `insforge-src/functions/vibescore-link-code-exchange.js`
- Modify (build output): `insforge-functions/vibescore-link-code-init.js`
- Modify (build output): `insforge-functions/vibescore-link-code-exchange.js`

**Step 1: Implement init function**

```js
// issue link code, store hash + session_id + expires_at
// return { link_code, expires_at }
```

**Step 2: Implement exchange function**

```js
// validate link_code + request_id, call RPC for atomic exchange
// return { token, device_id, user_id }
```

**Step 3: Build edge functions**

Run: `npm run build:insforge`
Expected: build outputs updated in `insforge-functions/`

**Step 4: Re-run edge function tests**

Run: `node --test test/edge-functions.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add insforge-src/functions/vibescore-link-code-init.js \
        insforge-src/functions/vibescore-link-code-exchange.js \
        insforge-functions/vibescore-link-code-init.js \
        insforge-functions/vibescore-link-code-exchange.js \
        test/edge-functions.test.js

git commit -m "feat: add link code init and exchange functions"
```

### Task 4: CLI `--link-code` support

**Files:**
- Modify: `src/commands/init.js`
- Modify: `src/lib/vibescore-api.js`
- Modify: `src/lib/insforge.js`
- Modify: `src/cli.js`
- Test: `test/init-uninstall.test.js` (or new `test/init-link-code.test.js`)

**Step 1: Write failing CLI test**

```js
// Ensure init accepts --link-code and calls exchange flow
```

**Step 2: Run test to verify it fails**

Run: `node --test test/init-uninstall.test.js`
Expected: FAIL (missing link-code path)

**Step 3: Implement link code exchange client**

```js
// add exchangeLinkCode({ baseUrl, linkCode, requestId }) in vibescore-api
```

**Step 4: Wire CLI init**

```js
// parse --link-code, call exchange, skip browser auth
```

**Step 5: Re-run CLI tests**

Run: `node --test test/init-uninstall.test.js`
Expected: PASS

**Step 6: Commit**

```bash
git add src/commands/init.js src/lib/vibescore-api.js src/lib/insforge.js src/cli.js test/init-uninstall.test.js

git commit -m "feat: support link code in cli init"
```

### Task 5: Dashboard UI + copy registry

**Files:**
- Modify: `dashboard/src/pages/DashboardPage.jsx`
- Modify: `dashboard/src/content/copy.csv`
- Test: `test/dashboard-render-order.test.js` or new `test/dashboard-link-code-install.test.js`

**Step 1: Add copy strings**

```csv
# add keys for install command with link code, copy button labels, masked user id
```

**Step 2: Add UI: command composition + copy button**

```js
// compose install command with link code
// add copy button using safeWriteClipboard
// display masked user id but copy full value
```

**Step 3: Run copy registry validation**

Run: `node scripts/validate-copy-registry.cjs`
Expected: PASS

**Step 4: Run dashboard tests**

Run: `node --test test/dashboard-render-order.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dashboard/src/pages/DashboardPage.jsx dashboard/src/content/copy.csv test/dashboard-render-order.test.js

git commit -m "feat: add install command copy flow"
```

### Task 6: Regression + verification record

**Files:**
- Modify: `docs/plans/2025-12-28-one-login-link-code/verification-report.md`
- Create (optional): `scripts/acceptance/link-code-exchange.cjs`

**Step 1: Run regression tests**

Run:
- `node --test test/edge-functions.test.js`
- `node --test test/init-uninstall.test.js`
- `node --test test/dashboard-render-order.test.js`
- `node scripts/acceptance/link-code-exchange.cjs` (if added)

Expected: all PASS

**Step 2: Update verification report**

Record commands + results in the verification report.

**Step 3: Commit**

```bash
git add docs/plans/2025-12-28-one-login-link-code/verification-report.md

git commit -m "docs: record verification for link code"
```
