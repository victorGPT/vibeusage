# Test Strategy

## Unit Tests
- New `usage-aggregate.test.js` for shared aggregation rules:
  - billable calculation per source type
  - missing fields default to zero
  - totals accumulation matches existing rules

## Integration Tests
- Existing usage endpoint tests updated to assert identical totals after refactor.
- Verify daily/summary/model-breakdown consistency for the same range.

## Regression Tests
- Run full suite: `node --test test/*.test.js`.

## Performance Guardrail
- Code review checklist: no new database queries, no extra passes over rows, no new data stores.
