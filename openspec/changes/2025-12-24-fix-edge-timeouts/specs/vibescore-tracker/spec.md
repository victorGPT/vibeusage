## MODIFIED Requirements
### Requirement: Auto sync uploads are throttled to half-hour cadence
The CLI auto sync path SHALL rate-limit uploads to at most one upload attempt per device every 30 minutes, while manual sync and init-triggered sync run immediately without upload throttling. Init-triggered sync SHALL be best-effort and MUST NOT block installation beyond a bounded timeout. If auto sync is skipped due to throttling/backoff while pending data exists, the CLI SHALL schedule a retry at or after the next allowed window without requiring a new notify event.

#### Scenario: Auto sync enforces half-hour throttle
- **GIVEN** a device ran `sync --auto` less than 30 minutes ago
- **WHEN** `sync --auto` runs again with pending data
- **THEN** the upload SHOULD be skipped until the next allowed window

#### Scenario: Auto sync schedules retry after throttle
- **GIVEN** pending half-hour buckets exist
- **AND** `sync --auto` is skipped due to throttle/backoff
- **WHEN** the next allowed window arrives
- **THEN** the CLI SHALL attempt a retry without requiring another notify event

#### Scenario: Manual sync uploads immediately
- **GIVEN** pending half-hour buckets exist
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** the upload SHOULD proceed immediately (no auto throttle)

#### Scenario: Init triggers an immediate sync
- **GIVEN** the user completes `npx @vibescore/tracker init`
- **WHEN** the command finishes
- **THEN** the CLI SHALL run a sync attempt to upload pending half-hour buckets
- **AND** the init command SHALL complete within a bounded timeout even if the sync fails

## ADDED Requirements
### Requirement: Dashboard usage requests are time-bounded
The dashboard MUST apply a client-side timeout to usage requests and MUST exit loading with either cached data or a visible error when the timeout elapses.

#### Scenario: Backend stalls during usage fetch
- **WHEN** a usage endpoint does not respond within the timeout window
- **THEN** the request SHALL be aborted
- **AND** the UI SHALL exit loading and render cached data if available, otherwise a visible error
