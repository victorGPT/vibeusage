# Change: Add dashboard cache for last-known data

## Why
When the backend is unavailable, the dashboard currently clears data even if it was previously fetched. This breaks the first impression and makes the UI appear empty during transient outages.

## What Changes
- Add client-side cache for usage summary/daily data keyed by user identity and range.
- Preserve last-known data on fetch errors (stale-while-revalidate).
- Surface a cached/stale indicator with a last-updated timestamp when data is served from cache.
- Reuse the existing heatmap cache behavior and align UX messaging.

## Impact
- Affected specs: `specs/vibescore-tracker/spec.md`
- Affected code: `dashboard/src/hooks/use-usage-data.js`, `dashboard/src/ui/matrix-a/components/UsagePanel.jsx`, `dashboard/src/pages/DashboardPage.jsx`
