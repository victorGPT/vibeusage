# Billable Total Tokens Backfill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Option C by writing `billable_total_tokens` at ingest, backfilling historical hourly rows, and updating read paths to prefer stored billable totals with a temporary fallback for NULL rows.

**Architecture:** Add DB columns on `vibescore_tracker_hourly`, compute billable totals in ingest, run an offline backfill script to fill NULLs, and update usage endpoints to prefer stored `billable_total_tokens` without double-counting. Keep rollup disabled; if enabled later, rebuild from hourly.

**Tech Stack:** Node.js scripts, Insforge edge functions, Postgres, Node test runner.

---

### Task 1: Add DB migration script for billable columns

**Files:**
- Create: `scripts/ops/billable-total-tokens-migration.sql`
- Test: `test/billable-total-tokens-migration.test.js`

**Step 1: Write the failing test**

`test/billable-total-tokens-migration.test.js`
```js
'use strict';

const fs = require('node:fs');
const assert = require('node:assert/strict');

const sql = fs.readFileSync('scripts/ops/billable-total-tokens-migration.sql', 'utf8');

assert.ok(sql.includes('billable_total_tokens'));
assert.ok(sql.includes('billable_rule_version'));
```

**Step 2: Run test to verify it fails**

Run: `node --test test/billable-total-tokens-migration.test.js`
Expected: FAIL (ENOENT until SQL file exists).

**Step 3: Write minimal implementation**

`scripts/ops/billable-total-tokens-migration.sql`
```sql
alter table public.vibescore_tracker_hourly
  add column if not exists billable_total_tokens bigint,
  add column if not exists billable_rule_version smallint;

-- Optional: temporary index for backfill (drop after)
create index concurrently if not exists vibescore_tracker_hourly_billable_null_idx
  on public.vibescore_tracker_hourly (hour_start)
  where billable_total_tokens is null;
```

**Step 4: Run test to verify it passes**

Run: `node --test test/billable-total-tokens-migration.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/ops/billable-total-tokens-migration.sql test/billable-total-tokens-migration.test.js
git commit -m "ops: add billable totals migration"
```

---

### Task 2: Write billable totals at ingest

**Files:**
- Modify: `insforge-src/functions/vibescore-ingest.js`
- Test: `test/edge-functions.test.js`

**Step 1: Write the failing test**

In `test/edge-functions.test.js` (inside the existing "vibeusage-ingest uses serviceRoleKey" test), add assertions:
```js
assert.equal(postBody[0]?.billable_total_tokens, '3');
assert.equal(postBody[0]?.billable_rule_version, 1);
```
Adjust the bucket to make billable differ from total:
```js
const bucket = {
  hour_start: new Date('2025-12-17T00:00:00.000Z').toISOString(),
  input_tokens: 1,
  cached_input_tokens: 1,
  output_tokens: 2,
  reasoning_output_tokens: 0,
  total_tokens: 4
};
```
For `codex`, billable = input + output + reasoning = 3.

**Step 2: Run test to verify it fails**

Run: `node --test test/edge-functions.test.js`
Expected: FAIL (billable fields missing).

**Step 3: Write minimal implementation**

In `insforge-src/functions/vibescore-ingest.js`:
```js
const { computeBillableTotalTokens } = require('../shared/usage-billable');
const BILLABLE_RULE_VERSION = 1;
```
Inside `buildRows`, compute and add:
```js
const billable = computeBillableTotalTokens({ source, totals: bucket });
...
billable_total_tokens: billable.toString(),
billable_rule_version: BILLABLE_RULE_VERSION,
```

**Step 4: Run test to verify it passes**

Run: `node --test test/edge-functions.test.js`
Expected: PASS (or only unrelated failures).

**Step 5: Commit**

```bash
git add insforge-src/functions/vibescore-ingest.js test/edge-functions.test.js
git commit -m "feat: write billable totals during ingest"
```

---

### Task 3: Add offline hourly backfill script

**Files:**
- Create: `scripts/ops/billable-total-tokens-backfill.cjs`
- Test: `test/billable-total-tokens-backfill.test.js`

**Step 1: Write the failing test**

`test/billable-total-tokens-backfill.test.js`
```js
'use strict';

const assert = require('node:assert/strict');
const { buildUpdates, BILLABLE_RULE_VERSION } = require('../scripts/ops/billable-total-tokens-backfill.cjs');

const rows = [
  {
    user_id: 'u1',
    device_id: 'd1',
    source: 'codex',
    model: 'm1',
    hour_start: '2025-12-17T00:00:00.000Z',
    input_tokens: 1,
    cached_input_tokens: 2,
    output_tokens: 3,
    reasoning_output_tokens: 0,
    total_tokens: 6
  }
];

const updates = buildUpdates(rows);
assert.equal(updates.length, 1);
assert.equal(updates[0].billable_total_tokens, '4');
assert.equal(updates[0].billable_rule_version, BILLABLE_RULE_VERSION);

const skipped = buildUpdates([{ ...rows[0], billable_total_tokens: '4' }]);
assert.equal(skipped.length, 0);
```

**Step 2: Run test to verify it fails**

Run: `node --test test/billable-total-tokens-backfill.test.js`
Expected: FAIL (module missing).

**Step 3: Write minimal implementation**

`scripts/ops/billable-total-tokens-backfill.cjs`:
- Export `buildUpdates(rows)` and `BILLABLE_RULE_VERSION` for tests.
- Use `computeBillableTotalTokens` to compute billable when missing.
- CLI args: `--from`, `--to`, `--batch-size`, `--sleep-ms`, `--dry-run`.
- Use `INSFORGE_BASE_URL` + `INSFORGE_SERVICE_ROLE_KEY` for API access.
- Fetch rows where `billable_total_tokens is null` ordered by `hour_start`.
- Upsert updates using `on_conflict=user_id,device_id,source,model,hour_start`.
- Throttle between batches; print progress.

**Step 4: Run test to verify it passes**

Run: `node --test test/billable-total-tokens-backfill.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/ops/billable-total-tokens-backfill.cjs test/billable-total-tokens-backfill.test.js
git commit -m "ops: add billable totals backfill script"
```

---

### Task 4: Prefer stored billable totals in read paths (no double-count)

**Files:**
- Modify: `insforge-src/functions/vibescore-usage-summary.js`
- Modify: `insforge-src/functions/vibescore-usage-daily.js`
- Modify: `insforge-src/functions/vibescore-usage-hourly.js`
- Modify: `insforge-src/functions/vibescore-usage-monthly.js`
- Modify: `insforge-src/functions/vibescore-usage-heatmap.js`
- Modify: `insforge-src/functions/vibescore-usage-model-breakdown.js`
- Test: `test/edge-functions.test.js`

**Step 1: Write/extend the failing tests**

Extend `test/edge-functions.test.js` to cover:
- Hourly aggregate uses `source` from rows and returns `billable_total_tokens`.
- Monthly uses stored billable totals when present.
- Summary/Daily avoid double-count when `billable_total_tokens` exists.
- Heatmap uses billable totals when present.

Example (summary double-count guard):
```js
assert.equal(body.totals.billable_total_tokens, '7');
```

**Step 2: Run test to verify it fails**

Run: `node --test test/edge-functions.test.js`
Expected: FAIL (current behavior double-counts or ignores stored billable).

**Step 3: Write minimal implementation**

Guidelines per endpoint:
- Include `billable_total_tokens` in SELECT lists.
- If `row.billable_total_tokens` is present, use it directly; otherwise compute via `computeBillableTotalTokens`.
- Do **not** add computed billable on top of stored billable.
- Hourly aggregate query must select `source` (group by source) so billable rules apply correctly.

**Step 4: Run test to verify it passes**

Run: `node --test test/edge-functions.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add insforge-src/functions/vibescore-usage-*.js test/edge-functions.test.js
git commit -m "fix: prefer stored billable totals in usage endpoints"
```

---

### Task 5: Rebuild Insforge bundle + update canvas + regression record

**Files:**
- Modify: `insforge-functions/*` (generated)
- Modify: `architecture.canvas`
- Modify: `docs/plans/2026-01-06-billable-total-tokens-design.md`

**Step 1: Rebuild Insforge bundle**

Run: `node scripts/build-insforge-functions.cjs`
Expected: PASS.

**Step 2: Update canvas**

Run: `node scripts/ops/architecture-canvas.cjs`
Mark backfill node as `Status: Implemented` if applicable.

**Step 3: Record regression commands**

Append to `docs/plans/2026-01-06-billable-total-tokens-design.md`:
- `node --test test/edge-functions.test.js` (PASS)

**Step 4: Commit**

```bash
git add insforge-functions architecture.canvas docs/plans/2026-01-06-billable-total-tokens-design.md
git commit -m "chore: sync insforge bundle and canvas"
```

## Regression Notes
- `node --test test/architecture-canvas.test.js` (PASS, 2026-01-06)
- `node --test test/billable-total-tokens-migration.test.js` (PASS, 2026-01-06)
- `node --test test/edge-functions.test.js` (FAIL, 2026-01-06) — expected until insforge-functions rebuild + hourly/monthly billable fixes.
- `node --test test/edge-functions.test.js` (FAIL, 2026-01-06, rerun) — pending insforge-functions rebuild for stored-billable paths.
- `node --test test/edge-functions.test.js` (FAIL, 2026-01-06, rerun) — pending insforge-functions rebuild to pick up stored-billable changes.
- `node --test test/edge-functions.test.js` (PASS, 2026-01-06)
- `node --test test/architecture-canvas.test.js` (PASS, 2026-01-06, rerun)
- `node --test test/billable-total-tokens-backfill.test.js` (PASS, 2026-01-06)
- `node --test test/billable-total-tokens-backfill.test.js` (PASS, 2026-01-06, rerun)
- `node --test test/architecture-canvas.test.js` (PASS, 2026-01-06, rerun)
