## MODIFIED Requirements
### Requirement: Leaderboard snapshots can be refreshed by automation
The system SHALL expose an authenticated refresh endpoint that rebuilds the current UTC leaderboard snapshots. It MUST accept an optional `period=day|week|month|total` query and return a structured JSON response (including errors) so automation can log actionable diagnostics per period.

#### Scenario: Automation logs per-period status
- **GIVEN** a valid service-role bearer token
- **WHEN** automation calls `POST /functions/vibescore-leaderboard-refresh?period=week`
- **THEN** the response SHALL be JSON with `success: true` or `error`
- **AND** the automation log SHALL include the HTTP status code and response body for that period
