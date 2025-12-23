## ADDED Requirements

### Requirement: Sync heartbeat records freshness
The system SHALL record a device sync heartbeat even when no events are uploaded, so that the backend can distinguish "unsynced" from "no usage".

#### Scenario: Sync with no new events still updates heartbeat
- **GIVEN** a device token is valid
- **WHEN** the CLI runs `sync` with zero new events
- **THEN** the backend SHALL update the device's `last_sync_at` (or equivalent) within the configured min interval

### Requirement: Hourly usage marks unsynced buckets
The hourly usage endpoint SHALL mark buckets after the latest sync timestamp as `missing: true` so the UI can distinguish unsynced hours.

#### Scenario: Latest sync timestamp splits the day
- **GIVEN** the user's latest sync is at `2025-12-22T12:30:00Z`
- **WHEN** the user calls `GET /functions/vibescore-usage-hourly?day=2025-12-22`
- **THEN** buckets after `12:00` UTC SHALL include `missing: true`
- **AND** buckets at or before `12:00` UTC SHALL NOT be marked missing

### Requirement: Heartbeat frequency is bounded
The system MUST bound heartbeat frequency to avoid backend overload.

#### Scenario: Rapid sync calls are rate-limited
- **GIVEN** the last heartbeat was less than 30 minutes ago
- **WHEN** the CLI calls the heartbeat endpoint again
- **THEN** the backend SHALL accept the request but MUST NOT update `last_sync_at`

## MODIFIED Requirements

### Requirement: Dashboard TREND truncates future buckets
The dashboard TREND chart SHALL NOT render the trend line into future buckets and SHALL visually distinguish buckets that are "unsynced" from buckets that are true zero usage.

#### Scenario: Unsynced buckets show missing markers
- **GIVEN** hourly data includes `missing: true` for recent hours
- **WHEN** the dashboard renders the day trend
- **THEN** it SHALL render missing markers (no line) for those hours
- **AND** it SHALL keep zero-usage buckets (missing=false) on the line
