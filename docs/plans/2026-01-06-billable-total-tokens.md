# Billable Total Tokens Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Compute `billable_total_tokens` server-side using provider-specific rules, and have all dashboard “total” displays use it.

**Architecture:** Keep raw token fields unchanged (`input/cached/output/reasoning/total`). Add a shared billable calculator in the Insforge layer, and have each usage endpoint (summary/daily/hourly/heatmap/monthly/model-breakdown) emit `billable_total_tokens`. Update the dashboard to prefer `billable_total_tokens` when present, falling back to `total_tokens`.

**Tech Stack:** Node.js CLI + tests, Insforge edge functions, React dashboard.

---

### Task 1: Update CLI ingestion for Claude + OpenCode cache creation

**Files:**
- Modify: `src/lib/rollout.js`
- Modify: `test/rollout-parser.test.js`

**Step 1: Write the failing test**

Add tests (or extend existing ones) to assert:
- Claude `input_tokens` includes `cache_creation_input_tokens`.
- OpenCode `input_tokens` includes `tokens.cache.write`.

Example (Claude):
```js
const line = buildClaudeUsageLine({ ts, input: 1, output: 1, cacheCreation: 3, cacheRead: 2 });
// expect queued[0].input_tokens === 4 and cached_input_tokens === 2
```

Example (OpenCode):
```js
const message = buildOpencodeMessage({ tokens: { input: 1, output: 1, reasoning: 0, cached: 2, cacheWrite: 5 } });
// expect queued[0].input_tokens === 6 and cached_input_tokens === 2
```

**Step 2: Run test to verify it fails**

Run: `node --test test/rollout-parser.test.js`
Expected: FAIL (input tokens do not include cache creation/write).

**Step 3: Write minimal implementation**

- In `normalizeClaudeUsage`, add `cache_creation_input_tokens` into `input_tokens`.
- In `normalizeOpencodeTokens`, add `tokens.cache.write` into `input_tokens`.

**Step 4: Run test to verify it passes**

Run: `node --test test/rollout-parser.test.js`
Expected: PASS.

**Step 5: Commit**

Hold until all tasks complete (per repo workflow).

---

### Task 2: Add shared billable total calculator (Insforge)

**Files:**
- Create: `insforge-src/shared/usage-billable.js`
- Create: `test/usage-billable.test.js`

**Step 1: Write the failing test**

Add tests for source rules:
- `codex/every-code`: billable = input + output + reasoning
- `claude`: billable = input + cached + output + reasoning
- `gemini`: billable = total
- `opencode`: billable = input + cached + output + reasoning
- `unknown`: billable = total if present else input + output + reasoning

**Step 2: Run test to verify it fails**

Run: `node --test test/usage-billable.test.js`
Expected: FAIL (module missing).

**Step 3: Write minimal implementation**

Implement `computeBillableTotalTokens({ source, totals })` using `toBigInt` and explicit source sets.

**Step 4: Run test to verify it passes**

Run: `node --test test/usage-billable.test.js`
Expected: PASS.

**Step 5: Commit**

Hold until all tasks complete (per repo workflow).

---

### Task 3: Emit billable totals in usage endpoints

**Files:**
- Modify: `insforge-src/functions/vibescore-usage-summary.js`
- Modify: `insforge-src/functions/vibescore-usage-daily.js`
- Modify: `insforge-src/functions/vibescore-usage-hourly.js`
- Modify: `insforge-src/functions/vibescore-usage-heatmap.js`
- Modify: `insforge-src/functions/vibescore-usage-monthly.js`
- Modify: `insforge-src/functions/vibescore-usage-model-breakdown.js`

**Step 1: Write/extend failing tests**

Extend `test/edge-functions.test.js` to assert `billable_total_tokens` appears in:
- usage-summary `totals`
- usage-daily `summary.totals`
- usage-hourly rows
- usage-model-breakdown rows
(heatmap/monthly use shared totals but can be covered indirectly if they share helper paths)

**Step 2: Run test to verify it fails**

Run: `node --test test/edge-functions.test.js`
Expected: FAIL (missing billable_total_tokens).

**Step 3: Write minimal implementation**

- Use `computeBillableTotalTokens` per row while aggregating.
- Add `billable_total_tokens` to totals/rows in each endpoint.

**Step 4: Run test to verify it passes**

Run: `node --test test/edge-functions.test.js`
Expected: PASS.

**Step 5: Commit**

Hold until all tasks complete (per repo workflow).

---

### Task 4: Update dashboard to prefer billable totals

**Files:**
- Modify: `dashboard/src/pages/DashboardPage.jsx`
- Modify: `dashboard/src/pages/AnnualPosterPage.jsx`
- Modify: `dashboard/src/lib/usage-aggregate.js`
- Modify: `dashboard/src/lib/details.js`
- Modify: `dashboard/src/lib/activity-heatmap.js`
- Modify: `dashboard/src/lib/model-breakdown.js`
- Modify: `dashboard/src/ui/matrix-a/components/TrendMonitor.jsx`

**Step 1: Write the failing test**

If no frontend tests exist, add a small unit test for `usage-aggregate` to ensure
`billable_total_tokens` is summed and preferred; otherwise document manual verification.

**Step 2: Run test to verify it fails**

Run: `node --test test/usage-aggregate.test.js`
Expected: FAIL (billable totals ignored).

**Step 3: Write minimal implementation**

- Prefer `billable_total_tokens` in summaries/rows/heatmaps/trends.
- Keep fallback to `total_tokens` when billable is missing.

**Step 4: Run test to verify it passes**

Run: `node --test test/usage-aggregate.test.js`
Expected: PASS.

**Step 5: Commit**

Hold until all tasks complete (per repo workflow).

---

### Task 5: Rebuild Insforge functions bundle

**Files:**
- Modify (generated): `insforge-functions/*.js`

**Step 1: Build**

Run: `node scripts/build-insforge-functions.cjs`
Expected: Updated `insforge-functions` outputs.

**Step 2: Verify**

Re-run: `node --test test/edge-functions.test.js`
Expected: PASS using bundled functions.

**Step 3: Commit**

Commit all changes.

---

## Final Verification

Run:
- `node --test test/rollout-parser.test.js`
- `node --test test/usage-billable.test.js`
- `node --test test/edge-functions.test.js`
- `node --test test/usage-aggregate.test.js`

Record results in the delivery summary.

## Regression Log

- 2026-01-06: `node --test test/edge-functions.test.js --test-name-pattern "model-breakdown sorts"` -> PASS
- 2026-01-06: `node --test test/rollout-parser.test.js --test-name-pattern "legacy file totals"` -> PASS
- 2026-01-06: `node --test test/rollout-parser.test.js` -> PASS
