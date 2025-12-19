## ADDED Requirements
### Requirement: Leaderboard is served from precomputed snapshots
The system SHALL compute leaderboard rankings from a precomputed snapshot that is refreshed asynchronously, without changing the leaderboard API contract.

#### Scenario: Leaderboard reads from latest snapshot
- **GIVEN** a snapshot exists for `period=week` with `generated_at`
- **WHEN** a signed-in user calls `GET /functions/vibescore-leaderboard?period=week`
- **THEN** the response SHALL reflect the latest snapshot totals
- **AND** the response SHALL include the snapshot `generated_at`

### Requirement: Leaderboard snapshots are refreshable by authorized automation
The system SHALL expose a refresh endpoint that rebuilds the current UTC leaderboard snapshots and is restricted to service-role callers.

#### Scenario: Automation refreshes leaderboard snapshots
- **GIVEN** a valid service-role bearer token
- **WHEN** the caller sends `POST /functions/vibescore-leaderboard-refresh`
- **THEN** the snapshots for `day|week|month|total` SHALL be regenerated
- **AND** the response SHALL include the refresh `generated_at` timestamp
