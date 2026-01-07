# Requirements Analysis

## Goal
Unify usage aggregation and billable totals computation across all usage endpoints without increasing query load or changing response behavior.

## In Scope
- Shared aggregation logic for totals and billable tokens.
- All usage endpoints: daily, hourly, heatmap, monthly, summary, model-breakdown.
- Tests to lock behavior equivalence.

## Out of Scope
- New storage layers or caching.
- Changes to query shapes or response schemas.
- Performance optimizations that alter data access patterns.

## Constraints
- No increase in query count or row scans.
- Single-pass row aggregation.
- PostgreSQL remains the source of truth.

## Risks
- Behavior drift if aggregation rules are misapplied.
- Hidden reliance on per-endpoint edge cases.

## Success Criteria
- Totals and billable totals match current behavior across all endpoints.
- No additional database queries introduced.
- Full test suite passes.
