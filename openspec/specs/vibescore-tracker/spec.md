# Spec: vibescore-tracker

## Purpose

Provide a safe, idempotent token-usage tracker for Codex CLI, backed by an InsForge backend and a web dashboard for viewing usage.
## Requirements
### Requirement: CLI installation and commands
The system SHALL provide a CLI package `@vibescore/tracker` with commands `init`, `sync`, `status`, and `uninstall`.

#### Scenario: CLI help is discoverable
- **WHEN** a user runs `npx @vibescore/tracker --help`
- **THEN** the output SHALL include `init`, `sync`, `status`, and `uninstall`

### Requirement: Public npm distribution for CLI
The system SHALL publish `@vibescore/tracker` to the public npm registry so users can run `npx --yes @vibescore/tracker <command>` without npm authentication.

#### Scenario: Public install via npx
- **WHEN** a user runs `npx --yes @vibescore/tracker --help` in a clean npm environment
- **THEN** the package SHALL download successfully and print CLI help without `404` or `403` errors

### Requirement: Notify hook install is safe and reversible
The system MUST configure Codex CLI `notify` without breaking existing user configuration, and MUST support restoring the previous `notify` configuration.

#### Scenario: Existing notify is preserved (chained)
- **GIVEN** `~/.codex/config.toml` already contains `notify = [...]`
- **WHEN** a user runs `npx @vibescore/tracker init`
- **THEN** the original notify command SHALL still be invoked (chained) after the tracker notify handler

#### Scenario: Uninstall restores original notify
- **GIVEN** the tracker was installed via `init`
- **WHEN** a user runs `npx @vibescore/tracker uninstall`
- **THEN** `~/.codex/config.toml` SHALL be restored to the pre-install notify configuration (or notify removed if none existed)

### Requirement: Notify handler is non-blocking and safe
The notify handler MUST be non-blocking, MUST exit with status code `0` even on errors, and MUST NOT prevent Codex CLI from completing a turn.

#### Scenario: Notify handler never fails the caller
- **WHEN** Codex CLI triggers the notify command and the handler encounters an internal error
- **THEN** the handler SHALL still exit `0`
- **AND** the handler SHALL NOT emit sensitive content to stdout/stderr

### Requirement: Incremental parsing with a strict data allowlist
The system SHALL incrementally parse `~/.codex/sessions/**/rollout-*.jsonl` and MUST only extract token usage from `payload.type == "token_count"` using an explicit allowlist of numeric fields, aggregating into UTC half-hour buckets.

#### Scenario: Parser ignores non-token_count records
- **GIVEN** a rollout file contains non-`token_count` records (including conversational content)
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** only `token_count`-derived numeric fields SHALL be aggregated into UTC half-hour buckets and queued for upload
- **AND** no conversational content SHALL be persisted or uploaded

### Requirement: Client uploads only half-hour aggregates
The system SHALL aggregate `token_count` records into UTC half-hour buckets and SHALL upload only half-hour aggregates (no per-event rows).

#### Scenario: Half-hour aggregation payload
- **GIVEN** multiple `token_count` events occur within the same UTC half-hour
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** the upload payload SHALL contain one row per UTC half-hour with summed token totals
- **AND** the payload SHALL NOT include per-event rows

### Requirement: Half-hour buckets are device-scoped and UTC-aligned
The ingest pipeline SHALL treat half-hour aggregates as keyed by `user_id + device_id + hour_start` where `hour_start` is a UTC half-hour boundary.

#### Scenario: Bucket key uses UTC hour
- **GIVEN** a device uploads usage for `2025-12-23T06:30:00Z`
- **WHEN** the backend stores the aggregate
- **THEN** it SHALL key the row by the UTC half-hour boundary and the device id

### Requirement: Client-side idempotency
The system MUST be safe to re-run. Upload retries and repeated `sync` executions MUST NOT double-count usage in the cloud.

#### Scenario: Re-running sync does not duplicate half-hour buckets
- **GIVEN** a user ran `npx @vibescore/tracker sync` successfully once
- **WHEN** the user runs `npx @vibescore/tracker sync` again without new Codex events
- **THEN** the ingest result SHOULD report `0` inserted buckets (or otherwise indicate no new data)

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

### Requirement: Device token authentication boundary
The ingest API MUST authenticate devices using a long-lived device token, and MUST NOT require the CLI to store a user JWT long-term.

#### Scenario: CLI stores device token, not user JWT
- **WHEN** a user completes the browser auth flow during `init`
- **THEN** the CLI SHALL persist only the device token (and device id) for future ingestion
- **AND** the CLI SHALL NOT persist any user JWT long-term

### Requirement: Sync heartbeat records freshness
The system SHALL record a device sync heartbeat even when no half-hour buckets are uploaded, so that the backend can distinguish "unsynced" from "no usage".

#### Scenario: Sync with no new buckets still updates heartbeat
- **GIVEN** a device token is valid
- **WHEN** the CLI runs `npx @vibescore/tracker sync` with zero new half-hour buckets
- **THEN** the backend SHALL update the device's `last_sync_at` (or equivalent) within the configured min interval

### Requirement: Usage endpoints derive from half-hour aggregates
The usage summary, daily, monthly, and heatmap endpoints SHALL derive totals from half-hour aggregate data.

#### Scenario: Daily total equals sum of half-hour buckets
- **GIVEN** half-hour aggregates exist for a day
- **WHEN** the user requests daily usage for that day
- **THEN** the total SHALL equal the sum of half-hour bucket totals

### Requirement: Hourly usage marks unsynced buckets
The hourly usage endpoint SHALL mark half-hour buckets after the latest sync timestamp as `missing: true` so the UI can distinguish unsynced hours.

#### Scenario: Latest sync timestamp splits the day
- **GIVEN** the user's latest sync is at `2025-12-22T12:30:00Z`
- **WHEN** the user calls `GET /functions/vibescore-usage-hourly?day=2025-12-22`
- **THEN** buckets after `12:30` UTC SHALL include `missing: true`
- **AND** buckets at or before `12:30` UTC SHALL NOT be marked missing

### Requirement: Dashboard UI is retro-TUI themed (visual only)
The Dashboard UI SHALL adopt the "Matrix UI A" visual system (based on `copy.jsx`) while preserving standard web interaction patterns (mouse clicks, form inputs, link navigation).

#### Scenario: Dashboard uses Matrix UI A components
- **WHEN** a user opens the dashboard home page
- **THEN** the UI SHALL be composed from reusable Matrix UI A components (e.g., framed boxes, compact data rows, trend charts)
- **AND** the underlying data flow (auth callback, usage queries) SHALL remain unchanged

### Requirement: Connect CLI page matches the theme
The `/connect` page SHALL share the same Matrix UI A theme and component system as the main dashboard.

#### Scenario: Connect CLI page uses Matrix UI A shell
- **WHEN** a user opens `/connect`
- **THEN** the page SHALL render in the same Matrix UI A visual system
- **AND** invalid redirect errors SHALL remain readable

### Requirement: UI and data logic are decoupled
The dashboard frontend MUST keep data logic decoupled from the UI layer so future theme swaps do not require touching auth/storage/fetch logic.

#### Scenario: UI components are props-driven
- **GIVEN** the dashboard renders a UI panel
- **THEN** UI components SHALL receive data via props/hooks outputs
- **AND** UI components SHALL NOT directly perform network requests or storage mutations

### Requirement: Dashboard shows a boot screen (visual only)
The dashboard UI SHALL provide a short, visual-only boot screen inspired by `copy.jsx`, without requiring any backend data.

#### Scenario: Boot screen appears briefly
- **WHEN** a user opens the dashboard home page
- **THEN** the UI MAY show a boot screen briefly before the main dashboard renders
- **AND** the boot screen SHALL NOT block sign-in or data loading beyond a short, fixed delay

### Requirement: Dashboard provides a GitHub-inspired activity heatmap
The dashboard UI SHALL render an activity heatmap derived from daily token usage, inspired by GitHub contribution graphs.

#### Scenario: Heatmap is derived from local daily totals when timezone parameters are provided
- **GIVEN** the user is signed in
- **WHEN** the dashboard fetches daily totals for a rolling range (e.g., last 52 weeks) with `tz`/`tz_offset_minutes`
- **THEN** the UI SHALL derive heatmap intensity levels (0..4) from `total_tokens` per local day
- **AND** missing days SHALL be treated as zero activity

### Requirement: Dashboard surfaces timezone basis for usage data
The dashboard SHALL display the timezone basis used by usage aggregates, and MUST keep the label consistent with the parameters sent to usage endpoints.

#### Scenario: User sees timezone basis label
- **GIVEN** the dashboard requests usage data with or without `tz`/`tz_offset_minutes`
- **WHEN** the user views the usage panels or activity heatmap
- **THEN** the UI SHALL show a visible label indicating the aggregate timezone basis

### Requirement: Dashboard does not support custom date filters
The dashboard UI MUST NOT provide arbitrary date range inputs. It SHALL only allow selecting a fixed `period` of `day`, `week` (Monday start, local calendar), `month`, or `total`.

#### Scenario: User can only switch predefined periods
- **GIVEN** the user is signed in
- **WHEN** the user views the dashboard query controls
- **THEN** the UI SHALL NOT present any `from/to` date picker inputs
- **AND** the UI SHALL allow selecting only `day|week|month|total`

### Requirement: Dashboard TREND truncates future buckets
The dashboard TREND chart SHALL NOT render the trend line into future local-calendar buckets that have not occurred yet, and SHALL visually distinguish "unsynced" buckets from true zero-usage buckets.

#### Scenario: Current date does not cover full period
- **GIVEN** the current local date/time is within an active period (e.g., mid-week or mid-month)
- **WHEN** the dashboard renders the TREND chart for that period
- **THEN** the trend line SHALL render only through the last available local bucket
- **AND** future buckets SHALL remain without a line

#### Scenario: Unsynced buckets show missing markers
- **GIVEN** half-hour data includes `missing: true` for recent hours
- **WHEN** the dashboard renders the day trend
- **THEN** it SHALL render missing markers (no line) for those hours
- **AND** it SHALL keep zero-usage buckets (`missing=false`) on the line

### Requirement: Leaderboard endpoint is available (calendar day/week/month/total)
The system SHALL provide a leaderboard endpoint that ranks users by `total_tokens` over a UTC calendar `day`, `week` (Sunday start), `month`, or `total` (all-time).

#### Scenario: User fetches the current weekly leaderboard
- **GIVEN** a user is signed in and has a valid `user_jwt`
- **WHEN** the user calls `GET /functions/vibescore-leaderboard?period=week`
- **THEN** the response SHALL include `from` and `to` in `YYYY-MM-DD` (UTC)
- **AND** the response SHALL include an ordered `entries` array sorted by `total_tokens` (desc)

### Requirement: Leaderboard response includes generation timestamp
The leaderboard endpoint SHALL include a `generated_at` timestamp indicating when the leaderboard data was produced.

#### Scenario: Response includes generated_at
- **GIVEN** a user is signed in and has a valid `user_jwt`
- **WHEN** the user calls `GET /functions/vibescore-leaderboard?period=month`
- **THEN** the response SHALL include `generated_at` as an ISO timestamp

### Requirement: Leaderboard response includes `me`
The leaderboard endpoint SHALL include a `me` object that reports the current user's `rank` and `total_tokens`, even when the user is not present in the `entries` array.

#### Scenario: User is not in Top N but still receives `me`
- **GIVEN** a user is signed in and has a valid `user_jwt`
- **AND** the user is not within the top requested `limit`
- **WHEN** the user calls `GET /functions/vibescore-leaderboard?period=week&limit=20`
- **THEN** the response SHALL include a `me` object with the user's `rank` and `total_tokens`

### Requirement: Leaderboard output is privacy-safe
The leaderboard endpoint MUST NOT expose PII (e.g., email) or any raw Codex logs. It SHALL only return publicly-safe profile fields and aggregated totals.

#### Scenario: Leaderboard never returns email or raw logs
- **WHEN** the user calls `GET /functions/vibescore-leaderboard`
- **THEN** the response SHALL NOT include any email fields
- **AND** the response SHALL NOT include any prompt/response/log content

### Requirement: Leaderboard is anonymous by default
Users SHALL be included in the leaderboard by default, but their identity MUST be anonymized unless they explicitly choose to make their leaderboard profile public.

#### Scenario: Default users appear as anonymous
- **GIVEN** a user has not enabled public leaderboard profile
- **WHEN** another signed-in user calls `GET /functions/vibescore-leaderboard`
- **THEN** the entry for that user SHALL have `display_name` set to a non-identifying value (e.g., `Anonymous`)
- **AND** `avatar_url` SHALL be `null`

### Requirement: Leaderboard enforces safe limits
The leaderboard endpoint MUST validate inputs and enforce reasonable limits to avoid excessive enumeration.

#### Scenario: Invalid parameters are rejected
- **WHEN** a user calls `GET /functions/vibescore-leaderboard?period=year`
- **THEN** the endpoint SHALL respond with `400`

### Requirement: Leaderboard snapshots can be refreshed by automation
The system SHALL expose an authenticated refresh endpoint that rebuilds the current UTC leaderboard snapshots, restricted to service-role or project-admin callers.

#### Scenario: Automation refreshes leaderboard snapshots
- **GIVEN** a valid service-role or project-admin bearer token
- **WHEN** the caller sends `POST /functions/vibescore-leaderboard-refresh`
- **THEN** the response SHALL include `generated_at` and per-period refresh results

### Requirement: Leaderboard privacy setting can be updated
The system SHALL provide an authenticated endpoint for the current user to update their leaderboard privacy preference.

#### Scenario: User sets leaderboard profile to public
- **GIVEN** a user is signed in and has a valid `user_jwt`
- **WHEN** the user calls `POST /functions/vibescore-leaderboard-settings` with body `{ "leaderboard_public": true }`
- **THEN** the response SHALL include `leaderboard_public: true`

### Requirement: Dashboard shows identity information from login state
The dashboard UI SHALL show an identity panel derived from the login state (name/email/userId). Rank MAY be shown as a placeholder until a backend rank endpoint exists.

#### Scenario: Identity panel uses auth fields
- **GIVEN** the user is signed in
- **WHEN** the dashboard renders the identity panel
- **THEN** it SHALL display `name` when available, otherwise fall back to `email`
- **AND** it MAY display `userId` as a secondary identifier

### Requirement: Debug output includes backend status and code
When debug mode is enabled, the CLI SHALL surface backend status and error code to aid troubleshooting.

#### Scenario: Debug output shows status and code
- **GIVEN** `VIBESCORE_DEBUG=1`
- **WHEN** `npx --yes @vibescore/tracker sync` encounters a backend error
- **THEN** stderr SHALL include `Status:` and `Code:` when available

### Requirement: Dashboard compositing effects are GPU-budgeted
The dashboard SHALL avoid `backdrop-filter` on large layout containers and SHALL limit heavy glow shadows to small accent elements, to reduce idle GPU spikes.

#### Scenario: Large containers avoid backdrop-filter
- **WHEN** the dashboard renders primary containers (e.g., `AsciiBox`, `SystemHeader`)
- **THEN** their computed `backdrop-filter` SHALL be `none`

#### Scenario: Accents keep limited glow
- **WHEN** the dashboard renders small accent elements (e.g., status badges)
- **THEN** subtle glow shadows MAY remain while large panels avoid heavy shadows

### Requirement: Matrix rain cost is further reduced
The Matrix rain animation SHALL reduce internal render scale and update rate while preserving full-screen coverage.

#### Scenario: Matrix rain uses reduced budget
- **WHEN** Matrix rain is visible
- **THEN** the internal render scale SHALL be `<= 0.5`
- **AND** the update rate SHALL be `<= 8 fps`
