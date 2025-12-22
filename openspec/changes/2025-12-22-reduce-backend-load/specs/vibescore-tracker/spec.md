## ADDED Requirements
### Requirement: Dashboard deduplicates usage-daily requests
The dashboard MUST avoid issuing redundant `GET /functions/vibescore-usage-daily` calls for the same `from/to/tz` window within a single refresh cycle.

#### Scenario: Week period reuses daily rows
- **GIVEN** `period=week`
- **WHEN** the dashboard renders the daily table and trend chart
- **THEN** it SHALL issue at most one `usage-daily` request for that window
- **AND** the trend chart SHALL reuse the daily rows already fetched

### Requirement: Summary is derived from daily when available
When daily rows are already fetched (i.e., `period!=total`), the dashboard MUST compute `summary` locally and MUST NOT call `GET /functions/vibescore-usage-summary` for the same window.

#### Scenario: Month period skips summary call
- **GIVEN** `period=month`
- **WHEN** the dashboard refreshes usage data
- **THEN** it SHALL compute summary from daily rows
- **AND** it SHALL NOT issue a `usage-summary` request for that window
