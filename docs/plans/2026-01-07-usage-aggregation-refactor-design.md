# Usage Aggregation Refactor (Plan A)

Date: 2026-01-07

## Summary
Unify usage aggregation logic across all usage endpoints by extracting a shared aggregator module. The change refactors row-level totals and billable calculations without adding new storage layers or increasing query load. Behavior and response shapes remain unchanged.

## Goals
- Ensure totals and billable totals are computed consistently across daily/hourly/heatmap/monthly/summary/model-breakdown.
- Reduce duplication and drift in aggregation logic.
- Keep query count and row scanning unchanged.

## Non-goals
- No new storage layer, cache, or rollup table changes.
- No response schema changes.
- No performance optimizations that alter query plans.

## Constraints
- Performance burden must not increase relative to current behavior.
- PostgreSQL remains the single source of truth.
- Aggregation must be single-pass over fetched rows.

## Proposed Design
Introduce a shared aggregation helper module in `insforge-src/shared/usage-aggregate.js` that centralizes billable resolution and totals bookkeeping. Usage endpoints continue to fetch rows exactly as they do today and delegate row-level billable handling to the shared helpers while keeping existing bucket maps and response shapes.

### Aggregation Helper Interface
- `resolveBillableTotals({ row, source, billableField, totals, hasStoredBillable })` returns `{ billable, hasStoredBillable }` using stored billable when available or derived billable when missing.
- `applyTotalsAndBillable({ totals, row, billable, hasStoredBillable })` applies `addRowTotals` and updates `billable_total_tokens` when stored billable is missing.

### Data Flow
1. Endpoint builds query as today and pages through rows.
2. Each row calls `resolveBillableTotals` and uses `applyTotalsAndBillable` for totals.
3. Endpoint formats totals/buckets and returns the existing response shape.

## Error Handling
- Query errors remain handled at the endpoint layer.
- Aggregator treats missing numeric fields as zero.
- When `billable_total_tokens` is absent, billable is derived using existing `computeBillableTotalTokens` rules.

## Testing Strategy
- Unit tests for the aggregator cover billable rules per source and mixed row inputs.
- Integration tests assert that totals match existing behavior for each endpoint.
- Add a cross-endpoint consistency test (summary vs daily vs model breakdown) in edge-functions tests.
- Regression test runs `node --test test/*.test.js`.

## Rollout
- Land as a refactor-only change with no response changes.
- Validate with unit + integration + full test suite before approval to implement.
