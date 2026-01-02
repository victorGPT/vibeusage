## ADDED Requirements

### Requirement: Usage summary aggregation is database-side
The system SHALL compute `vibescore-usage-summary` totals using database-side aggregation to avoid transferring per-hour rows to Edge Functions.

#### Scenario: Database-side aggregation
- **WHEN** a user requests `GET /functions/vibescore-usage-summary` for any valid range
- **THEN** the backend SHALL aggregate totals in Postgres (e.g., `SUM` + `GROUP BY`)
- **AND** the Edge Function SHALL receive only aggregated rows (not per-hour rows)
- **AND** if the aggregation RPC fails, the API SHALL return an error instead of falling back to full scans
