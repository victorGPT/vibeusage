# Change: Add usage summary cost calculation

## Why
We already track token usage counts but need a consistent, backend-derived cost for daily/weekly/monthly/total views. Cost should appear only in the total summary (not per-row), and pricing must be applied once with a clear basis and without double-counting cached/reasoning tokens.

## What Changes
- Add a pricing profile (temporary: GPT-5.2 rates used as gpt-5.2-codex proxy).
- Compute `total_cost_usd` in `vibescore-usage-summary` using overlap-safe billing (no per-row cost).
- Ensure the dashboard uses the summary totals for day/week/month/total and displays cost only in the total summary.
- Return pricing metadata (model, pricing mode, rates) in the summary response.
- Update API docs and add coverage in edge function tests.

## Impact
- Affected specs: `openspec/specs/vibescore-tracker/spec.md`
- Affected code: `insforge-src/shared/pricing.js`, `insforge-src/functions/vibescore-usage-summary.js`, `dashboard/src/pages/DashboardPage.jsx`
- Docs/tests: `BACKEND_API.md`, `test/edge-functions.test.js`, `dashboard/src/content/copy.csv`
