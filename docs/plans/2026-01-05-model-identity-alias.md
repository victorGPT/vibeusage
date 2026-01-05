# Model Identity Alias Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 统一模型身份映射并在 usage API 输出 `model_id` + display `model`，统计聚合不依赖定价来源。

**Architecture:** 新增共享 identity resolver + alias 表；所有 usage 读接口通过 resolver 归一化；前端以 `model_id` 为稳定 key。

**Tech Stack:** Node (edge functions), Supabase/InsForge DB, React dashboard, node:test.

---

### Task 1: Model identity resolver (unit tests first)

**Files:**
- Create: `insforge-src/shared/model-identity.js`
- Test: `test/model-identity.test.js`

**Step 1: Write the failing unit tests**

```js
const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  normalizeUsageModelKey,
  buildIdentityMap,
  applyModelIdentity
} = require('../insforge-src/shared/model-identity');

test('normalizeUsageModelKey lowercases and trims', () => {
  assert.equal(normalizeUsageModelKey(' GPT-4o '), 'gpt-4o');
  assert.equal(normalizeUsageModelKey(''), null);
});

test('buildIdentityMap selects latest effective mapping', () => {
  const map = buildIdentityMap({
    usageModels: ['gpt-4o-mini'],
    aliasRows: [
      { usage_model: 'gpt-4o-mini', canonical_model: 'gpt-4o', display_name: 'GPT-4o', effective_from: '2025-12-01' },
      { usage_model: 'gpt-4o-mini', canonical_model: 'gpt-4o', display_name: 'GPT-4o', effective_from: '2026-01-01' }
    ]
  });
  assert.deepEqual(map.get('gpt-4o-mini'), { model_id: 'gpt-4o', model: 'GPT-4o' });
});

test('applyModelIdentity falls back to raw model', () => {
  const identityMap = new Map();
  const res = applyModelIdentity({ rawModel: 'custom-model', identityMap });
  assert.equal(res.model_id, 'custom-model');
  assert.equal(res.model, 'custom-model');
});
```

**Step 2: Run test to verify it fails**

Run: `node --test test/model-identity.test.js`
Expected: FAIL with "Cannot find module" or missing exports.

**Step 3: Write minimal implementation**

```js
'use strict';

const DEFAULT_MODEL = 'unknown';

function normalizeUsageModelKey(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

function buildIdentityMap({ usageModels, aliasRows } = {}) {
  const map = new Map();
  const normalized = new Set();
  for (const model of Array.isArray(usageModels) ? usageModels : []) {
    const key = normalizeUsageModelKey(model);
    if (key) normalized.add(key);
  }
  const rows = Array.isArray(aliasRows) ? aliasRows : [];
  for (const row of rows) {
    const usageKey = normalizeUsageModelKey(row?.usage_model);
    const canonical = normalizeUsageModelKey(row?.canonical_model);
    if (!usageKey || !canonical) continue;
    if (!normalized.size || !normalized.has(usageKey)) continue;
    const existing = map.get(usageKey);
    const effective = String(row?.effective_from || '');
    if (!existing || effective > existing.effective_from) {
      map.set(usageKey, {
        model_id: canonical,
        model: row?.display_name ? String(row.display_name) : canonical,
        effective_from: effective
      });
    }
  }
  for (const key of normalized) {
    if (!map.has(key)) {
      map.set(key, { model_id: key, model: key, effective_from: '' });
    }
  }
  return new Map(
    Array.from(map.entries()).map(([key, value]) => [key, { model_id: value.model_id, model: value.model }])
  );
}

function applyModelIdentity({ rawModel, identityMap } = {}) {
  const normalized = normalizeUsageModelKey(rawModel) || DEFAULT_MODEL;
  const entry = identityMap && identityMap.get ? identityMap.get(normalized) : null;
  if (entry) return { model_id: entry.model_id, model: entry.model };
  const display = typeof rawModel === 'string' && rawModel.trim() ? rawModel.trim() : DEFAULT_MODEL;
  return { model_id: normalized, model: display };
}

module.exports = { normalizeUsageModelKey, buildIdentityMap, applyModelIdentity };
```

**Step 4: Run test to verify it passes**

Run: `node --test test/model-identity.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add test/model-identity.test.js insforge-src/shared/model-identity.js
git commit -m "feat: add model identity resolver"
```

---

### Task 2: Usage endpoints use canonical identity (integration tests first)

**Files:**
- Modify: `insforge-src/functions/vibescore-usage-model-breakdown.js`
- Modify: `insforge-src/functions/vibescore-usage-summary.js`
- Modify: `insforge-src/functions/vibescore-usage-daily.js`
- Modify: `insforge-src/functions/vibescore-usage-hourly.js`
- Modify: `insforge-src/functions/vibescore-usage-monthly.js`
- Modify: `insforge-src/functions/vibescore-usage-heatmap.js`
- Test: `test/edge-functions.test.js`

**Step 1: Write failing integration tests**

```js
test('vibeusage-usage-model-breakdown emits model_id and merges aliases', async () => {
  const fn = require('../insforge-functions/vibeusage-usage-model-breakdown');
  const userId = '77777777-7777-7777-7777-777777777777';
  const userJwt = 'user_jwt_test';

  const hourlyRows = [
    { source: 'codex', model: 'gpt-4o', total_tokens: 100, input_tokens: 60, cached_input_tokens: 0, output_tokens: 40, reasoning_output_tokens: 0 },
    { source: 'claude', model: 'gpt-4o-mini', total_tokens: 50, input_tokens: 30, cached_input_tokens: 0, output_tokens: 20, reasoning_output_tokens: 0 }
  ];
  const aliasRows = [
    { usage_model: 'gpt-4o-mini', canonical_model: 'gpt-4o', display_name: 'GPT-4o', effective_from: '2025-01-01', active: true }
  ];

  globalThis.createClient = (args) => ({
    auth: { getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    database: {
      from: (table) => {
        if (table === 'vibescore_tracker_hourly') return createQueryMock({ rows: hourlyRows });
        if (table === 'vibescore_model_aliases') {
          const query = createQueryMock({ rows: aliasRows });
          query.in = () => query;
          return query;
        }
        if (table === 'vibescore_pricing_profiles') {
          const query = createQueryMock({ rows: [] });
          query.or = () => query;
          query.limit = async () => ({ data: [], error: null });
          return query;
        }
        if (table === 'vibescore_pricing_model_aliases') {
          const query = createQueryMock({ rows: [] });
          query.in = () => query;
          return query;
        }
        throw new Error(`Unexpected table ${table}`);
      }
    }
  });

  const req = new Request(
    'http://localhost/functions/vibeusage-usage-model-breakdown?from=2025-01-01&to=2025-01-01',
    { method: 'GET', headers: { Authorization: `Bearer ${userJwt}` } }
  );
  const res = await fn(req);
  const body = await res.json();
  assert.equal(body.top_models[0].model_id, 'gpt-4o');
  assert.equal(body.top_models[0].model, 'GPT-4o');
});

test('vibeusage-usage-daily canonical model filter includes alias rows', async () => {
  const fn = require('../insforge-functions/vibeusage-usage-daily');
  const userId = '88888888-8888-8888-8888-888888888888';
  const userJwt = 'user_jwt_test';
  const hourlyRows = [
    { hour_start: '2025-01-01T00:00:00.000Z', source: 'codex', model: 'gpt-4o-mini', total_tokens: 50, input_tokens: 30, cached_input_tokens: 0, output_tokens: 20, reasoning_output_tokens: 0 }
  ];
  const aliasRows = [
    { usage_model: 'gpt-4o-mini', canonical_model: 'gpt-4o', display_name: 'GPT-4o', effective_from: '2025-01-01', active: true }
  ];

  globalThis.createClient = (args) => ({
    auth: { getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    database: {
      from: (table) => {
        if (table === 'vibescore_tracker_hourly') {
          const query = createQueryMock({ rows: hourlyRows });
          query.in = () => query;
          return query;
        }
        if (table === 'vibescore_model_aliases') {
          const query = createQueryMock({ rows: aliasRows });
          query.eq = () => query;
          query.in = () => query;
          return query;
        }
        throw new Error(`Unexpected table ${table}`);
      }
    }
  });

  const req = new Request(
    'http://localhost/functions/vibeusage-usage-daily?from=2025-01-01&to=2025-01-01&model=gpt-4o',
    { method: 'GET', headers: { Authorization: `Bearer ${userJwt}` } }
  );
  const res = await fn(req);
  const body = await res.json();
  assert.equal(body.model_id, 'gpt-4o');
  assert.equal(body.model, 'GPT-4o');
});
```

**Step 2: Run tests to verify they fail**

Run: `node --test test/edge-functions.test.js`
Expected: FAIL with missing `model_id` / merge behavior.

**Step 3: Implement minimal endpoint changes**
- Use shared resolver to build identity map from distinct models.
- Map per-row model to `{ model_id, model }` and aggregate by `model_id`.
- When `model` query param present: resolve alias list for canonical id and query `.in('model', usageModels)` (fallback to `.eq` when empty).
- Ensure responses include `model_id`.

**Step 4: Run tests to verify pass**

Run: `node --test test/edge-functions.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add insforge-src/functions/vibescore-usage-*.js test/edge-functions.test.js
git commit -m "feat: apply model identity mapping to usage endpoints"
```

---

### Task 3: Frontend + mocks + build artifacts

**Files:**
- Modify: `dashboard/src/lib/model-breakdown.js`
- Modify: `dashboard/src/ui/...` (model list keys)
- Modify: `dashboard/src/lib/mock-data.js`
- Modify: `insforge-functions/*` (via build)
- Docs: `BACKEND_API.md`

**Step 1: Write failing frontend regression tests**

```js
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildFleetData } = require('../dashboard/src/lib/model-breakdown.js');

test('buildFleetData returns model ids for stable keys', () => {
  const data = buildFleetData({
    sources: [
      {
        source: 'codex',
        totals: { total_tokens: '100', total_cost_usd: '1.00' },
        models: [
          { model: 'GPT-4o', model_id: 'gpt-4o', totals: { total_tokens: '100' } }
        ]
      }
    ]
  });
  assert.equal(data[0].models[0].id, 'gpt-4o');
});
```

**Step 2: Run tests to verify failure**

Run: `node --test test/*.test.js`
Expected: FAIL due to missing model_id usage.

**Step 3: Implement minimal frontend changes**
- Use `model_id` as stable key when available.
- Keep display name from `model` field.
- Update mocks to include `model_id` and `top_models[].model_id` if needed.

**Step 4: Build insforge functions**

Run: `npm run build:insforge`
Expected: generated `insforge-functions` updated without errors.

**Step 5: Run full test suite**

Run: `npm test`
Expected: all tests pass.

**Step 6: Commit**

```bash
git add dashboard/src insforge-functions BACKEND_API.md test
git commit -m "feat: propagate model identity to frontend"
```
