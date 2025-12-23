## ADDED Requirements
### Requirement: Dashboard retains last-known data during backend failures
The dashboard MUST retain and display the most recent successful usage data when backend requests fail, and MUST indicate the data is cached/stale with a last-updated timestamp.

#### Scenario: Backend unavailable after prior success
- **GIVEN** the user has previously loaded usage data successfully
- **WHEN** subsequent backend requests fail (network error or 5xx)
- **THEN** the dashboard SHALL continue to display the last-known usage summary, daily totals, and heatmap
- **AND** the UI SHALL label the data as cached/stale and show the last-updated timestamp

#### Scenario: Backend unavailable with no cache
- **GIVEN** the user has no cached usage data
- **WHEN** backend requests fail
- **THEN** the dashboard SHALL show the existing empty-state or error messaging (no stale data)
