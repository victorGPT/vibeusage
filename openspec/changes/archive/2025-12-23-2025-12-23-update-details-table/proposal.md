# Change: Update DETAILS table sorting, alignment, and period granularity

## Why
- DETAILS table does not match period granularity for day/total and the date sort is confusing.
- Users need consistent hour/day/month detail views with clear sorting indicators.

## What Changes
- Align DETAILS header text with numeric columns (left-aligned).
- DETAILS rows follow selected period: day -> hour, week/month -> day, total -> month.
- Total period shows latest 24 months with pagination (12 months per page).
- Date/time sorting defaults to newest-first; only the active column shows a sort indicator.

## Impact
- Affected specs: vibescore-tracker
- Affected code: dashboard/src/pages/DashboardPage.jsx, dashboard/src/lib/daily.js, dashboard/src/content/copy.csv
- **BREAKING**: none

## Architecture / Flow
- Reuse existing usage endpoints (daily/hourly/monthly) via existing hooks.
- Add client-side pagination for total period DETAILS.

## Risks & Mitigations
- Risk: UI regression in DETAILS table layout.
  - Mitigation: add unit coverage for sorting + manual regression runbook.

## Rollout / Milestones
- M1: Proposal + spec delta approved.
- M2: Implement + tests + regression record.
