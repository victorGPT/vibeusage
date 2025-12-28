# Change: Add structured monitoring for new edge functions

## Why
- Newly added backend endpoints lack structured request logs, which blocks attribution and triage.
- MVP operations require M1 structured logs to avoid misfixes.

## What Changes
- Add M1 request logging to newly added edge functions.
- Capture `upstream_status` and `upstream_latency_ms` for `vibescore-pricing-sync` upstream fetches.
- Regenerate `insforge-functions/` bundles.

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `insforge-src/functions/vibescore-user-status.js`, `insforge-src/functions/vibescore-entitlements.js`, `insforge-src/functions/vibescore-entitlements-revoke.js`, `insforge-src/functions/vibescore-usage-model-breakdown.js`, `insforge-src/functions/vibescore-pricing-sync.js`, `insforge-functions/*`
- **BREAKING**: none
