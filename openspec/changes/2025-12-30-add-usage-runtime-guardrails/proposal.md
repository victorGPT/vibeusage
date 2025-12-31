# Change: Add usage runtime guardrails and slow-query observability

## Why
- Recent InsForge logs show runtime proxy failures during usage reads.
- We need bounded query windows and actionable slow-query visibility to prevent runtime resets.

## What Changes
- Add slow-query structured logging to usage endpoints (summary/daily/hourly/monthly/heatmap/model-breakdown).
- Enforce maximum day-range for usage-summary, usage-daily, and usage-model-breakdown.
- Introduce configurable thresholds via environment variables.

## Impact
- Affected specs: `vibescore-tracker`.
- Affected code: `insforge-src/shared/logging.js`, `insforge-src/functions/vibescore-usage-*.js`, tests, and `insforge-functions/*` build output.
- **BREAKING**: None (invalid oversized ranges return 400).

## Architecture / Flow
- Guardrails are enforced at request validation before database queries.
- Slow-query logging is emitted only when duration >= threshold to avoid noise.

## Risks & Mitigations
- Risk: Range cap too small for legitimate backfills.
  - Mitigation: Configurable cap via `VIBESCORE_USAGE_MAX_DAYS`.
- Risk: Log volume increase.
  - Mitigation: Thresholded logging and concise payload.

## Rollout / Milestones
- M1/M2: Spec + plan approval.
- M3: Implement guardrails + logs with unit tests.
- M4: Run regression + targeted acceptance.
- M5: Deploy and monitor logs for slow-query signals.
