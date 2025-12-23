## ADDED Requirements
### Requirement: Usage summary prefers DB-side aggregation
The system MUST prefer database-side aggregation for `usage-summary` in the UTC path and MUST fall back to the legacy daily-rollup if aggregation is unsupported.

#### Scenario: DB aggregation success
- **GIVEN** the database supports aggregate selects
- **WHEN** the user calls `GET /functions/vibescore-usage-summary`
- **THEN** the response SHALL be computed via DB aggregation
- **AND** the legacy daily-rollup path SHALL NOT execute
