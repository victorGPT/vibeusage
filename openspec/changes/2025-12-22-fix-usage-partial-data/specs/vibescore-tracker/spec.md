## ADDED Requirements
### Requirement: Usage aggregates remain complete under timezone parameters (Phase 1)
The system MUST return complete aggregates even when `tz`/`tz_offset_minutes` are supplied, and in Phase 1 SHALL treat all usage queries as UTC to avoid event-level truncation.

#### Scenario: Non-UTC request returns complete UTC aggregate (Phase 1)
- **GIVEN** a user provides `tz=America/Los_Angeles`
- **WHEN** the user calls `GET /functions/vibescore-usage-daily`
- **THEN** the response SHALL be computed from the full event set
- **AND** the result SHALL match the UTC aggregate for the same `from/to`

#### Scenario: Summary matches daily rollup (Phase 1)
- **GIVEN** the same `from/to` inputs
- **WHEN** the user calls `GET /functions/vibescore-usage-summary` and `GET /functions/vibescore-usage-daily`
- **THEN** the summary totals SHALL equal the sum of daily rows
