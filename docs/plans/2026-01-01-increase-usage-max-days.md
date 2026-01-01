# Increase Usage Max Days Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Raise the default `VIBESCORE_USAGE_MAX_DAYS` to 800 days so the dashboard total window succeeds by default while keeping the guardrail and env override behavior.

**Architecture:** Update the shared guardrail helper (`insforge-src/shared/date.js`) and keep usage endpoints unchanged. Regenerate `insforge-functions/` output and align docs/specs with the new default.

**Tech Stack:** Node.js tests (`node --test`), Deno edge functions source (`insforge-src/`), generated functions (`insforge-functions/`).

---

### Task 1: Add failing test for default max-day value

**Files:**
- Modify: `test/edge-functions.test.js`

**Step 1: Write the failing test**

Add near other max-days guardrail tests:

```js
const { getUsageMaxDays } = require("../insforge-src/shared/date");

test("getUsageMaxDays defaults to 800 days", { concurrency: 1 }, () => {
  const prevMaxDays = process.env.VIBESCORE_USAGE_MAX_DAYS;
  try {
    delete process.env.VIBESCORE_USAGE_MAX_DAYS;
    assert.equal(getUsageMaxDays(), 800);
  } finally {
    if (prevMaxDays === undefined) delete process.env.VIBESCORE_USAGE_MAX_DAYS;
    else process.env.VIBESCORE_USAGE_MAX_DAYS = prevMaxDays;
  }
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
node --test test/edge-functions.test.js --test-name-pattern="getUsageMaxDays defaults to 800 days"
```

Expected: FAIL with actual value `370`.

### Task 2: Implement default change

**Files:**
- Modify: `insforge-src/shared/date.js`

**Step 1: Update default to 800**

Replace the default `370` in `getUsageMaxDays()`:

```js
if (raw == null || raw === "") return 800;
const n = Number(raw);
if (!Number.isFinite(n)) return 800;
if (n <= 0) return 800;
```

**Step 2: Run the targeted test**

Run:

```bash
node --test test/edge-functions.test.js --test-name-pattern="getUsageMaxDays defaults to 800 days"
```

Expected: PASS.

### Task 3: Update docs/specs and regenerate functions

**Files:**
- Modify: `BACKEND_API.md`
- Modify: `openspec/specs/vibescore-tracker/spec.md`
- Rebuild: `insforge-functions/` (via `npm run build:insforge`)

**Step 1: Update docs**
- `BACKEND_API.md`: change default from `370` to `800`.
- `openspec/specs/vibescore-tracker/spec.md`: change default from `370` to `800` in the requirement text.

**Step 2: Rebuild functions**

Run:

```bash
npm run build:insforge
```

Expected: build succeeds and updates `insforge-functions/*`.

### Task 4: Regression verification

**Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

**Step 2: Acceptance checks (manual, requires user JWT)**

```bash
curl -s -H "Authorization: Bearer <USER_JWT>" \
  "https://5tmappuk.us-east.insforge.app/functions/vibescore-usage-summary?from=2024-02-01&to=2026-01-01"

curl -s -H "Authorization: Bearer <USER_JWT>" \
  "https://5tmappuk.us-east.insforge.app/functions/vibescore-usage-summary?from=2023-01-01&to=2026-01-01"
```

Expected: first returns 200, second returns 400 with max-day error.

### Task 5: Commit

**Step 1: Stage and commit**

```bash
git add insforge-src/shared/date.js test/edge-functions.test.js BACKEND_API.md openspec/specs/vibescore-tracker/spec.md insforge-functions/ architecture.canvas
```

```bash
git commit -m "feat: raise usage max days default to 800"
```
