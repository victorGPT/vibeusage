# Change: Refactor usage aggregation into a shared module

## Why
Usage endpoints duplicate aggregation logic, creating drift risks and inconsistent totals. A shared aggregator improves correctness without changing behavior or adding storage layers.

## What Changes
- Extract a shared usage aggregation module for totals and billable computations.
- Update usage endpoints to use the shared aggregator.
- Add unit and integration tests to lock behavior.

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `insforge-src/shared/usage-billable.js`, `insforge-src/shared/usage-rollup.js`, usage endpoints in `insforge-src/functions/`
