## ADDED Requirements
### Requirement: Client uploads only half-hour aggregates
The CLI SHALL aggregate `token_count` records into UTC half-hour buckets and SHALL upload only half-hour aggregates (no per-event rows).

#### Scenario: Half-hour aggregation payload
- **GIVEN** multiple `token_count` events occur within the same UTC half-hour
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** the upload payload SHALL contain one row per UTC half-hour with summed token totals
- **AND** the payload SHALL NOT include per-event rows

### Requirement: Half-hour buckets are device-scoped and UTC-aligned
The ingest pipeline SHALL treat half-hour aggregates as keyed by `user_id + device_id + hour_start` where `hour_start` is a UTC half-hour boundary.

#### Scenario: Bucket key uses UTC half-hour
- **GIVEN** a device uploads usage for `2025-12-23T06:30:00Z`
- **WHEN** the backend stores the aggregate
- **THEN** it SHALL key the row by the UTC half-hour boundary and the device id

### Requirement: Half-hour aggregate upsert is idempotent
The ingest endpoint SHALL upsert half-hour aggregates without double-counting when the same bucket is re-sent.

#### Scenario: Re-sending the same bucket does not increase totals
- **GIVEN** a half-hour aggregate bucket has already been stored
- **WHEN** the same bucket is uploaded again with the same totals
- **THEN** the stored totals SHALL remain unchanged

### Requirement: Auto sync uploads are throttled to half-hour cadence
The CLI auto sync path SHALL rate-limit uploads to at most one upload attempt per device every 30 minutes, while manual sync and init-triggered sync run immediately without upload throttling.

#### Scenario: Auto sync enforces half-hour throttle
- **GIVEN** a device ran `sync --auto` less than 30 minutes ago
- **WHEN** `sync --auto` runs again with pending data
- **THEN** the upload SHOULD be skipped until the next allowed window

#### Scenario: Manual sync uploads immediately
- **GIVEN** pending half-hour buckets exist
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** the upload SHOULD proceed immediately (no auto throttle)

#### Scenario: Init triggers an immediate sync
- **GIVEN** the user completes `npx @vibescore/tracker init`
- **WHEN** the command finishes
- **THEN** the CLI SHALL run a sync to upload pending half-hour buckets

### Requirement: Raw event retention is capped
The system MUST NOT retain per-event token usage data beyond 30 days (if any event data is stored).

#### Scenario: Event rows older than 30 days are purged
- **GIVEN** event rows older than 30 days exist
- **WHEN** the retention job runs
- **THEN** those rows SHALL be removed

### Requirement: Usage endpoints derive from half-hour aggregates
The usage summary, daily, and monthly endpoints SHALL derive totals from half-hour aggregate data.

#### Scenario: Daily total equals sum of half-hour buckets
- **GIVEN** half-hour aggregates exist for a day
- **WHEN** the user requests daily usage for that day
- **THEN** the total SHALL equal the sum of half-hour bucket totals

## MODIFIED Requirements
### Requirement: Client-side idempotency
The system MUST be safe to re-run. Upload retries and repeated `sync` executions MUST NOT double-count usage in the cloud.

#### Scenario: Re-running sync does not duplicate half-hour buckets
- **GIVEN** a user ran `npx @vibescore/tracker sync` successfully once
- **WHEN** the user runs `npx @vibescore/tracker sync` again without new Codex events
- **THEN** the ingest result SHOULD report `0` updated buckets (or otherwise indicate no changes)
- **AND** stored totals SHALL remain unchanged
