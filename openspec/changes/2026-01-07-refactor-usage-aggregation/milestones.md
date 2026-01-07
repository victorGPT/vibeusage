# Milestones

## M1: Aggregator module + unit tests
- Shared aggregator module created.
- Unit tests for billable and totals rules passing.
- No endpoint changes yet.

## M2: Endpoint migration (partial)
- Daily, summary, model-breakdown migrated to shared aggregator.
- Endpoint tests passing for migrated endpoints.

## M3: Full endpoint migration
- Hourly, heatmap, monthly migrated.
- Full test suite passes (`node --test test/*.test.js`).

## M4: Verification + freeze
- Regression commands recorded.
- OpenSpec tasks updated with verification evidence.
