# Model Hourly Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure half-hour buckets are queued and uploaded per model (no unknown aggregation) across all CLI sources.

**Architecture:** The CLI parser continues to aggregate into per-model buckets. Queueing no longer collapses multiple models in the same hour, and uploader dedupe keys include model to match ingest uniqueness. Legacy per-hour queued state is preserved to avoid requeueing old aggregated buckets.

**Tech Stack:** Node.js CLI, `src/lib/rollout.js`, `src/lib/uploader.js`, Node test runner.

### Task 1: Queue per-model buckets (rollout)

**Files:**
- Modify: `src/lib/rollout.js`
- Test: `test/rollout-parser.test.js`

**Step 1: Write the failing test**

```js
test('parseRolloutIncremental keeps buckets separate per model within the same hour', async () => {
  // expects 2 queued buckets for two models in same hour
});
```

**Step 2: Run test to verify it fails**

Run: `node --test test/rollout-parser.test.js`
Expected: FAIL with `bucketsQueued` 1 vs 2.

**Step 3: Write minimal implementation**

- Update `enqueueTouchedBuckets` to queue per-model buckets.
- Preserve legacy `groupQueued` for hours already uploaded in aggregate form.
- Track per-bucket `queuedKey` to avoid requeueing unchanged buckets.

**Step 4: Run test to verify it passes**

Run: `node --test test/rollout-parser.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/rollout.js test/rollout-parser.test.js
git commit -m "fix(tracker): queue per-model buckets"
```

### Task 2: Upload dedupe key includes model

**Files:**
- Modify: `src/lib/uploader.js`
- Test: `test/uploader.test.js`

**Step 1: Write the failing test**

```js
test('drainQueueToCloud keeps buckets separate per model when hour/source match', async () => {
  // expects two buckets to be uploaded
});
```

**Step 2: Run test to verify it fails**

Run: `node --test test/uploader.test.js`
Expected: FAIL with `length` 1 vs 2.

**Step 3: Write minimal implementation**

- Update uploader bucket key to include `model`.

**Step 4: Run test to verify it passes**

Run: `node --test test/uploader.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/uploader.js test/uploader.test.js
git commit -m "fix(tracker): dedupe uploads by source+model+hour"
```

### Task 3: OpenSpec task tracking update

**Files:**
- Modify: `openspec/changes/2025-12-25-add-usage-model/tasks.md`

**Step 1: Add/adjust tasks for per-model queueing + uploader dedupe**

**Step 2: Run targeted verification**

Run: `node --test test/rollout-parser.test.js test/uploader.test.js`
Expected: PASS.

**Step 3: Commit**

```bash
git add openspec/changes/2025-12-25-add-usage-model/tasks.md
git commit -m "docs(openspec): track per-model queue/upload fixes"
```
