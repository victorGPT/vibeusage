# Spec: vibeusage-tracker

## Purpose

Provide a safe, idempotent token-usage tracker for Codex CLI, backed by an InsForge backend and a web dashboard for viewing usage.
## Requirements
### Requirement: CLI installation and commands

The system SHALL provide a consent-driven, low-noise init experience that does not modify local files before explicit user confirmation (or explicit non-interactive override), and `init` SHALL remain the only command that mutates local AI CLI integration state.

#### Scenario: Transparency report after setup

- **WHEN** local setup completes
- **THEN** the CLI SHALL print a summary list of integrations updated or skipped
- **AND** Claude Code SHALL be reported using plugin terminology rather than hook terminology

### Requirement: Public npm distribution for CLI

The system SHALL publish `vibeusage` to the public npm registry so users can run `npx --yes vibeusage <command>` without npm authentication.

#### Scenario: Public install via npx

- **WHEN** a user runs `npx --yes vibeusage --help` in a clean npm environment
- **THEN** the package SHALL download successfully and print CLI help without `404` or `403` errors

### Requirement: Notify hook install is safe and reversible

The system MUST configure Codex CLI `notify` and, when `~/.code/config.toml` exists, Every Code `notify` without breaking existing user configuration, and MUST support restoring the previous `notify` configuration.

#### Scenario: Existing notify is preserved (chained)

- **GIVEN** `~/.codex/config.toml` already contains `notify = [...]`
- **WHEN** a user runs `npx vibeusage init`
- **THEN** the original notify command SHALL still be invoked (chained) after the tracker notify handler

#### Scenario: Existing Every Code notify is preserved (chained)

- **GIVEN** `~/.code/config.toml` already contains `notify = [...]`
- **WHEN** a user runs `npx vibeusage init`
- **THEN** the original Every Code notify command SHALL still be invoked (chained) after the tracker notify handler

#### Scenario: Uninstall restores original notify

- **GIVEN** the tracker was installed via `init`
- **WHEN** a user runs `npx vibeusage uninstall`
- **THEN** `~/.codex/config.toml` SHALL be restored to the pre-install notify configuration (or notify removed if none existed)
- **AND** `~/.code/config.toml` SHALL be restored to the pre-install notify configuration (or notify removed if none existed)

### Requirement: Notify handler is non-blocking and safe

The notify handler MUST be non-blocking, MUST exit with status code `0` even on errors, and MUST NOT prevent Codex CLI from completing a turn. The handler SHALL chain the original notify for the invoking CLI based on an explicit source flag and SHALL avoid self-recursion.

#### Scenario: Notify handler never fails the caller

- **WHEN** Codex CLI triggers the notify command and the handler encounters an internal error
- **THEN** the handler SHALL still exit `0`
- **AND** the handler SHALL NOT emit sensitive content to stdout/stderr

### Requirement: Every Code notify auto-config is conditional

The system SHALL only attempt to configure Every Code `notify` when `~/.code/config.toml` exists (or when `CODE_HOME` points to a directory containing `config.toml`).

#### Scenario: Missing Every Code config is skipped

- **GIVEN** `~/.code/config.toml` does not exist
- **WHEN** a user runs `npx vibeusage init`
- **THEN** the tracker SHALL NOT create or modify `~/.code/config.toml`

#### Scenario: Existing Every Code config is updated

- **GIVEN** `~/.code/config.toml` exists
- **WHEN** a user runs `npx vibeusage init`
- **THEN** the tracker SHALL set `notify` to invoke the tracker handler with `--source=every-code`

### Requirement: Incremental parsing with a strict data allowlist

The system SHALL incrementally parse `~/.codex/sessions/**/rollout-*.jsonl` and MUST only extract token usage from `payload.type == "token_count"` using an explicit allowlist of numeric fields, aggregating into UTC half-hour buckets.

#### Scenario: Parser ignores non-token_count records

- **GIVEN** a rollout file contains non-`token_count` records (including conversational content)
- **WHEN** the user runs `npx vibeusage sync`
- **THEN** only `token_count`-derived numeric fields SHALL be aggregated into UTC half-hour buckets and queued for upload
- **AND** no conversational content SHALL be persisted or uploaded

### Requirement: Gemini CLI usage parsing from session JSON

The system SHALL parse Gemini CLI session JSON files under `~/.gemini/tmp/**/chats/session-*.json` and MUST only extract numeric token usage fields from `messages[].tokens`, aggregating into UTC half-hour buckets with `source = "gemini"`. The system MUST ignore `messages[].content` and MUST NOT persist or upload any non-numeric content.

#### Scenario: Content fields are ignored

- **GIVEN** a Gemini session JSON includes `messages[].content`
- **WHEN** the user runs `npx vibeusage sync`
- **THEN** no content text SHALL be persisted or uploaded

#### Scenario: Model is captured or set to unknown

- **GIVEN** a Gemini session JSON includes `messages[].model`
- **WHEN** the user runs `npx vibeusage sync`
- **THEN** the bucket SHALL record the trimmed model string
- **AND** if missing or empty, the bucket SHALL set `model = "unknown"`

### Requirement: Gemini token mapping matches allowlist

The system SHALL map Gemini token usage fields from `messages[].tokens` as follows: `input_tokens = input`, `cached_input_tokens = cached`, `output_tokens = output + tool`, `reasoning_output_tokens = thoughts`, and `total_tokens = total`.

#### Scenario: Output tokens include tool tokens

- **GIVEN** `messages[].tokens` includes `output` and `tool`
- **WHEN** the user runs `npx vibeusage sync`
- **THEN** the bucket SHALL store `output_tokens = output + tool`

### Requirement: Client uploads only half-hour aggregates

The system SHALL aggregate `token_count` records into UTC half-hour buckets and SHALL upload only half-hour aggregates (no per-event rows).

#### Scenario: Half-hour aggregation payload

- **GIVEN** multiple `token_count` events occur within the same UTC half-hour
- **WHEN** the user runs `npx vibeusage sync`
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

- **GIVEN** a user ran `npx vibeusage sync` successfully once
- **WHEN** the user runs `npx vibeusage sync` again without new Codex events
- **THEN** the ingest result SHOULD report `0` inserted buckets (or otherwise indicate no new data)

### Requirement: Half-hour aggregate upsert is idempotent

The ingest endpoint SHALL upsert half-hour aggregates without double-counting when the same bucket is re-sent.

#### Scenario: Re-sending the same bucket does not increase totals

- **GIVEN** a half-hour aggregate bucket has already been stored
- **WHEN** the same bucket is uploaded again with the same totals
- **THEN** the stored totals SHALL remain unchanged

### Requirement: Auto sync uploads are throttled to half-hour cadence

The CLI auto sync path SHALL rate-limit uploads to at most one upload attempt per device every 30 minutes, while manual sync and init-triggered sync run immediately without upload throttling. If auto sync is skipped due to throttling/backoff while pending data exists, the CLI SHALL schedule a retry at or after the next allowed window without requiring a new notify event.

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
- **WHEN** the user runs `npx vibeusage sync`
- **THEN** the upload SHOULD proceed immediately (no auto throttle)

#### Scenario: Init triggers an immediate sync

- **GIVEN** the user completes `npx vibeusage init`
- **WHEN** the command finishes
- **THEN** the CLI SHALL run a sync to upload pending half-hour buckets

### Requirement: Raw event retention is capped

The system MUST NOT retain per-event token usage data beyond 30 days (if any event data is stored).

#### Scenario: Event rows older than 30 days are purged

- **GIVEN** event rows older than 30 days exist
- **WHEN** the retention job runs
- **THEN** those rows SHALL be removed

### Requirement: PostgreSQL is the single source of truth for aggregates

The system SHALL treat PostgreSQL as the single source of truth for usage aggregates, and SHALL only introduce redundant stores with explicit justification and rollback documentation.

#### Scenario: Redundant storage proposal

- **WHEN** a new cache or derived store for aggregates is proposed
- **THEN** the proposal SHALL document the primary source of truth and a rollback plan
- **AND** it SHALL include measurable performance justification

### Requirement: Schema guardrails for new tables

The system SHALL apply PostgreSQL schema guardrails to new tables and columns to minimize long-term performance and correctness debt.

#### Scenario: New table or column is introduced

- **WHEN** a new schema element is added
- **THEN** timestamps SHALL use `timestamptz`
- **AND** money SHALL use `numeric`
- **AND** required fields SHALL be `NOT NULL` with defaults where appropriate
- **AND** foreign key columns SHALL be indexed

### Requirement: Least-privilege database access

The system SHALL enforce least-privilege access boundaries between clients and the database.

#### Scenario: Client reads data

- **WHEN** the dashboard or CLI needs data
- **THEN** it SHALL authenticate via user or device tokens
- **AND** it SHALL NOT use service-role credentials directly

### Requirement: Client SDK access is centralized

The system SHALL restrict InsForge SDK usage in client code to approved wrapper modules and SHALL prevent clients from referencing internal base URLs.

#### Scenario: Client module needs InsForge access

- **WHEN** the CLI or dashboard needs to call InsForge
- **THEN** it SHALL import SDK access only via `src/lib/insforge-client` or `dashboard/src/lib/insforge-client`
- **AND** it SHALL NOT reference `INSFORGE_INTERNAL_URL` directly

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
- **WHEN** the CLI runs `npx vibeusage sync` with zero new half-hour buckets
- **THEN** the backend SHALL update the device's `last_sync_at` (or equivalent) within the configured min interval

### Requirement: Usage endpoints derive from half-hour aggregates

The usage summary, daily, monthly, and heatmap endpoints SHALL derive totals from half-hour aggregate data.

#### Scenario: Daily total equals sum of half-hour buckets

- **GIVEN** half-hour aggregates exist for a day
- **WHEN** the user requests daily usage for that day
- **THEN** the total SHALL equal the sum of half-hour bucket totals

### Requirement: Usage debug payload for slow-query validation

When a usage endpoint is called with `debug=1`, the response MUST include a `debug` object with `request_id`, `status`, `query_ms`, `slow_threshold_ms`, and `slow_query`. The `debug` object MUST be absent when `debug` is not enabled.

#### Scenario: Debug payload returned when enabled

- **WHEN** a client calls `GET /functions/vibeusage-usage-summary?from=YYYY-MM-DD&to=YYYY-MM-DD&debug=1`
- **THEN** the response SHALL include the `debug` object

#### Scenario: Debug payload omitted by default

- **WHEN** a client calls `GET /functions/vibeusage-usage-summary?from=YYYY-MM-DD&to=YYYY-MM-DD`
- **THEN** the response SHALL NOT include the `debug` object

### Requirement: Usage endpoints exclude canary buckets by default

Usage endpoints SHALL exclude `source=model=canary` buckets unless explicitly requested via `source=canary` or `model=canary`.

#### Scenario: Default usage queries ignore canary buckets

- **WHEN** a user calls a usage endpoint without `source=canary` or `model=canary`
- **THEN** canary buckets SHALL be excluded from aggregates

### Requirement: Usage endpoints canonicalize model identity

Usage endpoints SHALL resolve usage model names to a canonical `model_id` via alias mapping for the effective date. The `model` query parameter SHALL accept a canonical id and expand to all active aliases for the requested range. Responses that include model identity SHALL emit both `model_id` (canonical) and display `model`.

#### Scenario: Canonical model filter includes alias rows

- **GIVEN** an alias mapping `gpt-4o-mini -> gpt-4o` is active for the requested date range
- **WHEN** a client calls `GET /functions/vibeusage-usage-daily?model=gpt-4o`
- **THEN** usage from `gpt-4o-mini` SHALL be included in the aggregates
- **AND** the response SHALL return `model_id = "gpt-4o"`

#### Scenario: Model breakdown returns canonical ids

- **WHEN** a client calls `GET /functions/vibeusage-usage-model-breakdown`
- **THEN** each model entry SHALL include `model_id` (canonical) and display `model`

### Requirement: Hourly usage marks unsynced buckets

The hourly usage endpoint SHALL mark buckets after the latest sync timestamp as `missing: true` so the UI can distinguish unsynced hours. When `tz` or `tz_offset_minutes` is provided, the `day` parameter SHALL be interpreted in that timezone; otherwise it SHALL default to UTC.

#### Scenario: Latest sync timestamp splits the local day

- **GIVEN** the user's latest sync is at `2025-12-22T12:30:00Z`
- **AND** the dashboard calls `GET /functions/vibeusage-usage-hourly?day=2025-12-22&tz=America/Los_Angeles`
- **WHEN** the local day is rendered
- **THEN** buckets after the local hour containing the sync time SHALL include `missing: true`
- **AND** buckets at or before that local hour SHALL NOT be marked missing

### Requirement: Dashboard UI is retro-TUI themed (visual only)

The Dashboard UI SHALL adopt the "Matrix UI A" visual system (based on `copy.jsx`) while preserving standard web interaction patterns (mouse clicks, form inputs, link navigation).

#### Scenario: Dashboard uses Matrix UI A components

- **WHEN** a user opens the dashboard home page
- **THEN** the UI SHALL be composed from reusable Matrix UI A components (e.g., framed boxes, compact data rows, trend charts)
- **AND** the underlying data flow (auth callback, usage queries) SHALL remain unchanged

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

The dashboard UI SHALL render an activity heatmap derived from daily token usage in the dashboard's local timezone, inspired by GitHub contribution graphs.

#### Scenario: Heatmap is derived from local daily totals

- **GIVEN** the user is signed in and the dashboard provides timezone parameters
- **WHEN** the dashboard fetches daily totals for a rolling range (e.g., last 52 weeks)
- **THEN** the UI SHALL derive heatmap intensity levels (0..4) from `total_tokens` per local day
- **AND** missing days SHALL be treated as zero activity

### Requirement: Dashboard surfaces timezone basis for usage data

The dashboard SHALL display the timezone basis used by usage aggregates, and MUST keep the label consistent with the parameters sent to usage endpoints.

#### Scenario: User sees timezone basis label

- **GIVEN** the dashboard requests usage data with or without `tz`/`tz_offset_minutes`
- **WHEN** the user views the usage panels or activity heatmap
- **THEN** the UI SHALL show a visible label indicating the aggregate timezone basis

### Requirement: Dashboard does not support custom date filters

The dashboard UI MUST NOT provide arbitrary date range inputs. It SHALL only allow selecting a fixed `period` of `day`, `week` (Monday start), `month`, or `total`, computed in the browser timezone.

#### Scenario: User can only switch predefined periods

- **GIVEN** the user is signed in
- **WHEN** the user views the dashboard query controls
- **THEN** the UI SHALL NOT present any `from/to` date picker inputs
- **AND** the UI SHALL allow selecting only `day|week|month|total`

### Requirement: Dashboard TREND truncates future buckets

The dashboard TREND chart SHALL NOT render the trend line into future buckets that have not occurred yet in the dashboard timezone, and SHALL visually distinguish "unsynced" buckets from true zero-usage buckets. When timezone parameters are omitted, the dashboard SHALL use UTC as the basis.

#### Scenario: Current date does not cover full period (dashboard timezone)

- **GIVEN** the current dashboard timezone date/time is within an active period (e.g., mid-week or mid-month)
- **WHEN** the dashboard renders the TREND chart for that period
- **THEN** the trend line SHALL render only through the last available bucket in that timezone
- **AND** future buckets SHALL remain without a line

#### Scenario: Unsynced buckets show missing markers

- **GIVEN** hourly data includes `missing: true` for recent hours in the dashboard timezone
- **WHEN** the dashboard renders the day trend
- **THEN** it SHALL render missing markers (no line) for those hours
- **AND** it SHALL keep zero-usage buckets (`missing=false`) on the line

### Requirement: Leaderboard endpoint supports week|month|total periods

The system SHALL provide a leaderboard endpoint that ranks users over the current UTC period window, scoped by a `metric` category and a `period` window:

- `period=week`: current UTC calendar week (Sunday start)
- `period=month`: current UTC calendar month (1st..last day)
- `period=total`: all-time (represented as `from=1970-01-01` and `to=9999-12-31`)

Metric categories:

- `metric=all`: rank by `total_tokens`
- `metric=gpt`: rank by `gpt_tokens`
- `metric=claude`: rank by `claude_tokens`

Token accounting:

- `gpt_tokens` SHALL be the sum of `total_tokens` for GPT-family models.
- `claude_tokens` SHALL be the sum of `billable_total_tokens` for Claude-family models (falling back to `total_tokens` when billable is missing).
- `total_tokens` SHALL equal `gpt_tokens + claude_tokens`.
- Rows with `model = "unknown"` SHALL be excluded.
- Buckets with `source = "canary"` SHALL be excluded.
- Buckets with `source` not in `codex|every-code|claude|opencode` SHALL be excluded (leaderboard tracks Code sources only).

Model family matching:

- GPT-family: `model LIKE 'gpt-%' OR model LIKE 'openai/%' OR model LIKE '%/gpt-%'`.
- Claude-family: `model LIKE 'claude-%' OR model LIKE 'anthropic/%' OR model LIKE '%/claude-%'`.

#### Scenario: User fetches the current leaderboard for a period

- **GIVEN** a user is signed in and has a valid `user_jwt`
- **WHEN** the user calls `GET /functions/vibeusage-leaderboard?period=week|month|total&metric=all&limit=20&offset=0`
- **THEN** the response SHALL include `from` and `to` in `YYYY-MM-DD` (UTC)
- **AND** the response SHALL include pagination metadata: `page`, `limit`, `offset`, `total_entries`, `total_pages`
- **AND** the response SHALL include `metric`
- **AND** the response SHALL include an ordered `entries` array sorted by the requested metric (desc)
- **AND** each entry SHALL include `rank`, `is_me`, `display_name`, `avatar_url`, `gpt_tokens`, `claude_tokens`, and `total_tokens`

### Requirement: Leaderboard response includes generation timestamp

The leaderboard endpoint SHALL include a `generated_at` timestamp indicating when the leaderboard data was produced.

#### Scenario: Response includes generated_at

- **GIVEN** a user is signed in and has a valid `user_jwt`
- **WHEN** the user calls `GET /functions/vibeusage-leaderboard?period=week&metric=all`
- **THEN** the response SHALL include `generated_at` as an ISO timestamp

### Requirement: Leaderboard response includes `me`

The leaderboard endpoint SHALL include a `me` object that reports the current user's `rank`, `gpt_tokens`, `claude_tokens`, and `total_tokens`, even when the user is not present in the `entries` array.

#### Scenario: User is not in Top N but still receives `me`

- **GIVEN** a user is signed in and has a valid `user_jwt`
- **AND** the user is not within the requested page (`offset..offset+limit`)
- **WHEN** the user calls `GET /functions/vibeusage-leaderboard?period=week&metric=all&limit=20`
- **THEN** the response SHALL include a `me` object with the user's `rank`, `gpt_tokens`, `claude_tokens`, and `total_tokens`

### Requirement: Leaderboard output is privacy-safe

The leaderboard endpoint MUST NOT expose PII (e.g., email) or any raw Codex logs. It SHALL only return publicly-safe profile fields and aggregated totals.

#### Scenario: Leaderboard never returns email or raw logs

- **WHEN** the user calls `GET /functions/vibeusage-leaderboard`
- **THEN** the response SHALL NOT include any email fields
- **AND** the response SHALL NOT include any prompt/response/log content

### Requirement: Leaderboard is anonymous by default

Users SHALL be included in the leaderboard by default, but their identity MUST be anonymized unless they explicitly choose to make their leaderboard profile public.

#### Scenario: Default users appear as anonymous

- **GIVEN** a user has not enabled public leaderboard profile
- **WHEN** another signed-in user calls `GET /functions/vibeusage-leaderboard`
- **THEN** the entry for that user SHALL have `display_name` set to a non-identifying value (e.g., `Anonymous`)
- **AND** `avatar_url` SHALL be `null`

### Requirement: Leaderboard enforces safe limits

The leaderboard endpoint MUST validate inputs and enforce reasonable limits to avoid excessive enumeration.

#### Scenario: Invalid parameters are rejected

- **WHEN** a user calls `GET /functions/vibeusage-leaderboard?period=year` OR `...period=day`
- **THEN** the endpoint SHALL respond with `400`
- **AND** it SHALL respond with `400` when `metric` is not one of `all|gpt|claude`

### Requirement: Leaderboard snapshots can be refreshed by automation

The system SHALL expose an authenticated refresh endpoint that rebuilds the current UTC leaderboard snapshots for `period=week|month|total`. It MUST accept an optional `period` query and return a structured JSON response (including errors) so automation can log actionable diagnostics per run. When `period` is omitted, automation SHALL refresh `week` + `month`.

#### Scenario: Automation logs per-period status

- **GIVEN** a valid service-role bearer token
- **WHEN** automation calls `POST /functions/vibeusage-leaderboard-refresh?period=week|month|total`
- **THEN** the response SHALL be JSON with `success: true` or `error`
- **AND** the automation log SHALL include the HTTP status code and response body for that period

### Requirement: Leaderboard privacy setting can be updated

The system SHALL provide an authenticated endpoint for the current user to update their leaderboard privacy preference.

#### Scenario: User sets leaderboard profile to public

- **GIVEN** a user is signed in and has a valid `user_jwt`
- **WHEN** the user calls `POST /functions/vibeusage-leaderboard-settings` with body `{ "leaderboard_public": true }`
- **THEN** the response SHALL include `leaderboard_public: true`

### Requirement: Leaderboard settings update SHOULD prefer single upsert

The system SHALL attempt a single upsert when updating leaderboard privacy settings, and SHALL fall back to the legacy select/update/insert flow if the upsert is unavailable.

#### Scenario: Upsert succeeds

- **WHEN** a signed-in user updates `leaderboard_public`
- **THEN** the system SHALL perform a single upsert to persist the change
- **AND** the response payload SHALL remain unchanged

#### Scenario: Upsert unsupported

- **WHEN** the upsert attempt fails due to unsupported constraints
- **THEN** the system SHALL fall back to the legacy select/update/insert flow

### Requirement: Dashboard renders leaderboard page with period selector

The dashboard SHALL render a leaderboard page at `/leaderboard`, including:

- A period selector (`WEEK|MONTH|ALL`) that maps to `period=week|month|total`
- A "Public Profile" toggle that controls whether the current user's identity is shown to other users on the leaderboard
- A paginated table of ranks

The dashboard UI SHALL request `metric=all` (no metric selector in MVP).

#### Scenario: Signed-in user visits /leaderboard

- **GIVEN** the user is signed in
- **WHEN** the user visits `/leaderboard`
- **THEN** the dashboard SHALL request `GET /functions/vibeusage-leaderboard?period=week&metric=all`
- **AND** the UI SHALL render a period selector and a paginated table using the returned `entries`

#### Scenario: User switches period

- **GIVEN** the user is on `/leaderboard`
- **WHEN** the user selects `period=month` or `period=total`
- **THEN** the dashboard SHALL request `GET /functions/vibeusage-leaderboard?period=<selected>&metric=all`

### Requirement: Dashboard injects YOU row into first page when YOU is not in page

When the signed-in user is not present within the requested first page (`offset=0..limit-1`), the dashboard SHALL inject a highlighted `YOU` row into the first page to make the user's rank visible without changing the displayed `rank` value.

#### Scenario: YOU rank is outside first page but is still visible

- **GIVEN** the API returns a `me.rank` that is not within the first page slice
- **WHEN** the dashboard renders the first page table
- **THEN** the UI SHALL drop one row from the middle of the first page and insert a highlighted `YOU` row near position 5
- **AND** the injected row SHALL display `rank = me.rank` (not the injected position)

### Requirement: Dashboard shows identity information from login state

The dashboard UI SHALL show the authenticated viewer's identity from the current-user profile. The current-user profile SHALL be the single source of truth for dashboard display identity. Session payload fields and redirect parameters MUST NOT be treated as authoritative display identity.

#### Scenario: Dashboard identity panel resolves profile-backed identity

- **GIVEN** the user is signed in with a valid `accessToken` and `userId`
- **WHEN** the dashboard renders the identity panel
- **THEN** it SHALL resolve display identity from the authenticated user's profile
- **AND** it SHALL ignore stale or missing session `name` fields for display purposes
- **AND** it SHALL fall back to the anonymous label only when the resolved profile lacks a usable display name

#### Scenario: Token-only session restore hydrates profile before display

- **GIVEN** the dashboard restores a valid auth session that includes `accessToken` and `userId` but lacks display identity fields
- **WHEN** the dashboard resolves the current viewer identity
- **THEN** it SHALL hydrate profile data from the backend using the authenticated `userId`
- **AND** the identity panel SHALL display the hydrated profile name instead of deriving identity from session fallbacks

### Requirement: Public dashboard share link

The system SHALL allow an authenticated user to issue a revocable public dashboard link, storing only a hash of the share token and enforcing a single active link per user.

#### Scenario: Issue and rotate share link

- **WHEN** an authenticated user requests a Public View link
- **THEN** the system SHALL return a new share token
- **AND** the previous token (if any) SHALL be invalidated
- **AND** only the token hash SHALL be stored

#### Scenario: Revoke share link

- **WHEN** an authenticated user revokes Public View
- **THEN** the active share token SHALL be marked revoked
- **AND** the revoked token SHALL be rejected on subsequent requests

### Requirement: Share token read-only access

The system SHALL accept valid share tokens for read-only usage endpoints and scope responses to the link owner only.

#### Scenario: Valid share token

- **WHEN** a request to a usage endpoint includes a valid share token
- **THEN** the response SHALL match the authenticated response shape
- **AND** data SHALL be scoped to the share-link owner

#### Scenario: Invalid or revoked share token

- **WHEN** a share token is invalid or revoked
- **THEN** the endpoint SHALL return an authorization error

### Requirement: Public View dashboard rendering

The dashboard SHALL render the full Public View layout at `/share/:token` without requiring sign-in, while hiding auth/installation prompts.

#### Scenario: Public viewer opens a valid link

- **WHEN** a user opens `/share/:token` with a valid token
- **THEN** the full dashboard layout SHALL render in read-only mode
- **AND** sign-in and install prompts SHALL be hidden

#### Scenario: Public viewer opens an invalid link

- **WHEN** a user opens `/share/:token` with an invalid or revoked token
- **THEN** the UI SHALL show an invalid-link state

### Requirement: Debug output includes backend status and code

When debug mode is enabled, the CLI SHALL surface backend status and error code to aid troubleshooting.

#### Scenario: Debug output shows status and code

- **GIVEN** `VIBEUSAGE_DEBUG=1`
- **WHEN** `npx --yes vibeusage sync` encounters a backend error
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

### Requirement: Usage heatmap endpoint is available

The system SHALL provide a heatmap endpoint that returns a GitHub-inspired activity heatmap derived from UTC daily token usage for the authenticated user.

#### Scenario: User fetches a 52-week heatmap

- **GIVEN** a user is signed in and has a valid `user_jwt`
- **WHEN** the user calls `GET /functions/vibeusage-usage-heatmap?weeks=52`
- **THEN** the response SHALL include a `weeks` grid with intensity `level` values in the range `0..4`
- **AND** missing days SHALL be treated as zero activity

### Requirement: Heatmap endpoint enforces safe limits

The heatmap endpoint MUST validate inputs and enforce reasonable limits to avoid excessive range queries.

#### Scenario: Invalid parameters are rejected

- **WHEN** a user calls `GET /functions/vibeusage-usage-heatmap` with an invalid `to` date or an out-of-range `weeks` value
- **THEN** the endpoint SHALL respond with `400`

### Requirement: Edge Functions are modular in-source but single-file in deployment

The system SHALL keep Edge Function author sources under `insforge-src/functions-esm/` with modular ESM shared helpers, while still producing single-file deployable artifacts under `insforge-functions/`, to respect InsForge2's single-file Edge Function deployment constraint.

#### Scenario: Build generates deployable single-file artifacts

- **GIVEN** a developer modifies shared Edge Function logic under `insforge-src/functions-esm/shared/` or `insforge-src/shared/*.mjs`
- **WHEN** the developer runs the Edge Function build script
- **THEN** the repository SHALL generate updated deployable artifacts under `insforge-functions/`
- **AND** each artifact SHALL remain a single-file ESM module exporting a default async request handler compatible with the InsForge Deno runtime

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

### Requirement: Web UI copy is managed by a registry

The system SHALL centralize all web UI text in a repository-hosted copy registry, and UI components SHALL reference copy via stable keys.

#### Scenario: Update copy without touching code

- **WHEN** a user updates a text value in the registry table
- **THEN** the corresponding UI text SHALL update without editing component code

#### Scenario: Copy is traceable to its module

- **WHEN** a copy entry is reviewed
- **THEN** it SHALL include module/page/component metadata to identify its origin

### Requirement: Dashboard shows data source indicator

The dashboard SHALL display a data source label (`edge|cache|mock`) for usage and activity panels so users can distinguish live data from cached or mocked data.

#### Scenario: Mock mode is explicit

- **GIVEN** mock mode is enabled via `VITE_VIBEUSAGE_MOCK=1` or `?mock=1`
- **WHEN** the dashboard renders
- **THEN** the UI SHALL show `DATA_SOURCE: MOCK`

#### Scenario: Cache fallback is explicit

- **GIVEN** the user is signed in and cached data is used due to a fetch failure
- **WHEN** the dashboard renders usage or heatmap panels
- **THEN** the UI SHALL show `DATA_SOURCE: CACHE`

#### Scenario: Live data is explicit

- **GIVEN** the user is signed in and backend requests succeed
- **WHEN** the dashboard renders usage or heatmap panels
- **THEN** the UI SHALL show `DATA_SOURCE: EDGE`

### Requirement: User JWT validation resolves users reliably

The system SHALL ensure user-JWT authentication can resolve user identity even when the auth table lives in the `auth` schema.

#### Scenario: Auth SDK can resolve the current user

- **GIVEN** `auth.users` exists and `public.users` is a view of `auth.users`
- **WHEN** a client calls a user-JWT endpoint (e.g., `GET /functions/vibeusage-usage-summary`)
- **THEN** the auth layer resolves the user and the endpoint returns 200.

### Requirement: Hourly usage endpoint for day trend

The system SHALL provide an hourly usage endpoint that returns UTC 24-hour aggregates for a given day.

#### Scenario: User requests hourly usage for today

- **GIVEN** a signed-in user with a valid `user_jwt`
- **WHEN** the user calls `GET /functions/vibeusage-usage-hourly?day=YYYY-MM-DD`
- **THEN** the response SHALL include `day` and a `data` array with up to 24 hourly buckets in UTC
- **AND** each bucket SHALL include `total_tokens` (and related token fields) with bigints encoded as strings

### Requirement: Monthly usage endpoint for total trend

The system SHALL provide a monthly usage endpoint that returns the most recent 24 UTC months of aggregates.

#### Scenario: User requests recent 24 months

- **GIVEN** a signed-in user with a valid `user_jwt`
- **WHEN** the user calls `GET /functions/vibeusage-usage-monthly?months=24&to=YYYY-MM-DD`
- **THEN** the response SHALL include `from`, `to`, `months=24`, and a `data` array keyed by `month` (`YYYY-MM`)
- **AND** each month SHALL include `total_tokens` (and related token fields) with bigints encoded as strings

### Requirement: TREND chart uses period-aligned granularity

The dashboard TREND module SHALL use period-aligned aggregates: `day=hourly`, `week|month=daily`, `total=monthly(24)`.

#### Scenario: User switches periods on the dashboard

- **GIVEN** the user is signed in and views the dashboard
- **WHEN** the user switches between `day`, `week`, `month`, and `total`
- **THEN** the TREND chart SHALL request and render the corresponding aggregation granularity
- **AND** the X-axis labels SHALL align with the chosen period (hours for day, dates for week/month, months for total)

### Requirement: TREND chart truncates future buckets

The dashboard TREND module SHALL NOT render the trend line into future UTC buckets that have not occurred yet.

#### Scenario: Current date does not cover full period

- **GIVEN** the current UTC date/time is within an active period (e.g., mid-week or mid-month)
- **WHEN** the dashboard renders the TREND chart for that period
- **THEN** the trend line SHALL render only through the last available UTC bucket
- **AND** future buckets SHALL remain without a line

### Requirement: User JWT validation uses anon key

The system SHALL validate user JWTs using the project anon key so that user-authenticated endpoints (usage/leaderboard) return data when a valid token is provided.

#### Scenario: Valid user token returns usage data

- **GIVEN** a valid user JWT
- **WHEN** the user calls `GET /functions/vibeusage-usage-summary`
- **THEN** the response SHALL be `200` with a JSON payload

### Requirement: Ingest handles duplicate-heavy batches efficiently

The system SHALL ingest batches idempotently using a bulk write that ignores duplicate `event_id` entries, and MUST avoid per-row inserts in the normal duplicate replay case.

#### Scenario: Duplicate replay succeeds without errors

- **GIVEN** a batch containing duplicate `event_id` values
- **WHEN** the client calls `POST /functions/vibeusage-ingest` with up to 500 events
- **THEN** the response SHALL be `200` with `inserted` and `skipped` counts
- **AND** the ingest path SHALL NOT fail due to duplicate conflicts

### Requirement: CLI applies backpressure on ingest failures

The CLI MUST respect server-provided backoff signals and apply exponential backoff on retryable failures to avoid burst traffic.

#### Scenario: Retry-After is honored

- **GIVEN** ingest responds with `503` and `Retry-After: 60`
- **WHEN** auto sync runs again
- **THEN** the next upload attempt SHALL be delayed by at least 60 seconds

### Requirement: Dashboard backend probe is low-frequency and passive

The dashboard SHALL rate-limit backend status probes and pause polling when the page is hidden.

#### Scenario: Hidden tab stops probing

- **GIVEN** the dashboard tab is hidden
- **WHEN** the page remains hidden for two intervals
- **THEN** no backend probe requests SHALL be issued until the tab becomes visible

### Requirement: Client integrations use InsForge SDK

The system SHALL route CLI and Dashboard InsForge interactions through the official `@insforge/sdk` client wrappers while preserving existing auth boundaries (`user_jwt` for dashboard reads, `device_token` for ingest).

#### Scenario: CLI requests use SDK wrapper

- **WHEN** the CLI issues a device token or uploads ingest events
- **THEN** the request SHALL be executed via the SDK client wrapper
- **AND** the request SHALL still authenticate with the same token type as before

#### Scenario: Dashboard requests use SDK wrapper

- **WHEN** the dashboard fetches usage summary/daily/heatmap/leaderboard data
- **THEN** the request SHALL be executed via the SDK client wrapper
- **AND** the dashboard SHALL continue to use `user_jwt` for authorization

### Requirement: SDK version is pinned consistently

The system SHALL pin the same `@insforge/sdk` version in both the root package and the dashboard package.

#### Scenario: Dependencies are aligned

- **WHEN** `package.json` in root and `dashboard/` are inspected
- **THEN** both SHALL reference the same `@insforge/sdk` version string

### Requirement: Trend monitor uses the v2 TUI layout

The dashboard SHALL render the Trend monitor using the provided v2 TUI layout, including axes, grid, scan sweep, and period-based X-axis labels.

#### Scenario: Trend monitor renders with period-based X-axis labels

- **GIVEN** the user is signed in and viewing the dashboard
- **WHEN** the user switches the Zion_Index period (day/week/month/total)
- **THEN** the X-axis SHALL show hours for `day`, dates for `week/month`, and months for `total`
- **AND** the Trend monitor SHALL render values derived from the same daily usage data slice

#### Scenario: Hover tooltip shows exact value

- **GIVEN** the user hovers a point on the Trend monitor
- **WHEN** the tooltip appears
- **THEN** it SHALL display the exact token value (non-abbreviated) and the UTC date
- **AND** a vertical guide line and point marker SHALL indicate the hovered position

#### Scenario: Y-axis uses compact notation

- **GIVEN** the Trend monitor renders
- **WHEN** the user reads the Y-axis tick labels
- **THEN** large values SHALL be formatted as `K/M/B` abbreviations

#### Scenario: Minimal display when no data

- **GIVEN** the user has no daily usage data for the selected period
- **WHEN** the dashboard renders the Trend monitor
- **THEN** the Trend monitor SHALL still render axes, grid, and labels with a flat signal

#### Scenario: Panel label uses trend naming

- **GIVEN** the dashboard renders the Trend monitor
- **WHEN** the user views the panel header
- **THEN** the label SHALL read `Trend`

### Requirement: Copy registry sync uses `origin/main` as the official source

The system SHALL provide a copy registry sync command that treats `origin/main:dashboard/src/content/copy.csv` as the authoritative source and displays which source was used for the operation.

#### Scenario: Pull shows the authoritative source

- **WHEN** a user runs `node scripts/copy-sync.cjs pull --dry-run`
- **THEN** the output SHALL indicate `origin/main:dashboard/src/content/copy.csv` as the source of truth

### Requirement: Pull is safe by default

The system SHALL make `pull` a dry-run by default, MUST avoid modifying `dashboard/src/content/copy.csv` unless explicitly confirmed, MUST create a local backup before any write, and SHALL present a diff preview for the copy registry.

#### Scenario: Pull dry-run does not write

- **GIVEN** local `dashboard/src/content/copy.csv` exists
- **WHEN** a user runs `node scripts/copy-sync.cjs pull --dry-run`
- **THEN** the file SHALL NOT be modified
- **AND** the script SHALL present a diff preview

### Requirement: Push is gated by validation and explicit confirmation

The system MUST validate the copy registry before push, MUST show a diff preview, MUST require an explicit confirmation flag to write or push updates, and SHALL auto-commit `copy.csv` when it is the only dirty file.

#### Scenario: Push is blocked without confirmation

- **GIVEN** the local copy registry passes validation
- **WHEN** a user runs `node scripts/copy-sync.cjs push --dry-run`
- **THEN** no write or remote push SHALL occur
- **AND** the script SHALL show the diff preview

#### Scenario: Push fails on validation errors

- **GIVEN** the local copy registry has schema errors
- **WHEN** a user runs `node scripts/copy-sync.cjs push --confirm`
- **THEN** the operation SHALL abort and report validation failures

#### Scenario: Push fails on dirty working tree

- **GIVEN** `git status` reports uncommitted changes outside `dashboard/src/content/copy.csv`
- **WHEN** a user runs `node scripts/copy-sync.cjs push --confirm`
- **THEN** the operation SHALL abort with a clear message

#### Scenario: Push auto-commits copy registry changes

- **GIVEN** `dashboard/src/content/copy.csv` is the only modified file
- **WHEN** a user runs `node scripts/copy-sync.cjs push --confirm`
- **THEN** the script SHALL create a commit for the copy registry change before any remote push

### Requirement: Usage aggregates remain complete under timezone parameters (Phase 1)

The system MUST return complete aggregates even when `tz`/`tz_offset_minutes` are supplied, and in Phase 1 SHALL treat all usage queries as UTC to avoid event-level truncation.

#### Scenario: Non-UTC request returns complete UTC aggregate (Phase 1)

- **GIVEN** a user provides `tz=America/Los_Angeles`
- **WHEN** the user calls `GET /functions/vibeusage-usage-daily`
- **THEN** the response SHALL be computed from the full event set
- **AND** the result SHALL match the UTC aggregate for the same `from/to`

#### Scenario: Summary matches daily rollup (Phase 1)

- **GIVEN** the same `from/to` inputs
- **WHEN** the user calls `GET /functions/vibeusage-usage-summary` and `GET /functions/vibeusage-usage-daily`
- **THEN** the summary totals SHALL equal the sum of daily rows

### Requirement: Dashboard GPU spike investigation is reproducible

The system SHALL maintain a repeatable runbook for diagnosing idle GPU spikes on the dashboard, including baseline measurement, isolation steps, and evidence capture.

#### Scenario: Investigator can reproduce and isolate spikes

- **GIVEN** a dashboard idle GPU spike is reported
- **WHEN** the investigator follows the runbook
- **THEN** they SHALL be able to reproduce the spike, isolate major contributors, and record evidence (trace or screenshots)

### Requirement: Backend probe SHOULD adapt its cadence

The dashboard SHALL adapt probe cadence based on backend health, using longer intervals on success and shorter retries on failure, without changing the external interface.

#### Scenario: Stable backend

- **WHEN** the backend probe succeeds repeatedly
- **THEN** the probe interval SHALL back off to reduce unnecessary load

#### Scenario: Backend failure

- **WHEN** the backend probe fails
- **THEN** the system SHALL retry using a shorter interval before declaring the backend down

### Requirement: Dashboard resolves edge function path compatibility

The dashboard SHALL prefer calling edge functions under `/functions` and SHALL fall back to `/api/functions` when the preferred path returns HTTP 404, limited to idempotent GET requests.

#### Scenario: 404 fallback for usage summary

- **WHEN** the dashboard calls `GET /functions/vibeusage-usage-summary`
- **AND** the gateway responds with HTTP 404
- **THEN** the dashboard SHALL retry `GET /api/functions/vibeusage-usage-summary`
- **AND** use the response if the legacy path succeeds

#### Scenario: Unauthorized does not fallback

- **WHEN** the dashboard calls `GET /functions/vibeusage-usage-summary`
- **AND** the gateway responds with HTTP 401
- **THEN** the dashboard SHALL NOT retry `/api/functions/...`

### Requirement: Device token issuance SHALL compensate on partial failure

The system SHALL attempt to remove the newly created device record if token insertion fails, to avoid leaving orphaned devices.

#### Scenario: Token insert fails

- **WHEN** the device record is created but token insert fails
- **THEN** the system SHALL attempt to delete the newly created device record
- **AND** the endpoint SHALL return an error without exposing sensitive data

### Requirement: Service-role ingest avoids redundant pre-reads

When ingesting with service-role credentials, the system MUST avoid a pre-read of existing events by default and SHOULD use an upsert-with-ignore-duplicates strategy to preserve idempotency.

#### Scenario: Service-role ingest uses upsert fast path

- **GIVEN** a service-role token
- **WHEN** the device uploads a batch with potential duplicate `event_id`
- **THEN** the server SHALL attempt an `on_conflict` insert with `ignore-duplicates`
- **AND** fall back to the legacy path only if upsert is unsupported

### Requirement: Leaderboard fallback query SHALL apply pagination at source

The system SHALL apply the requested `limit` and `offset` when querying the leaderboard view in the non-snapshot fallback path, so only the requested page rows are fetched (plus `me` when needed).

#### Scenario: Limit enforced at query

- **WHEN** a user requests `GET /functions/vibeusage-leaderboard?period=week&metric=all&limit=20&offset=40`
- **THEN** the backend SHALL query only the requested page rows (rank `41..60`)
- **AND** the response payload SHALL remain unchanged

### Requirement: Leaderboard fallback SHOULD use single query when possible

The system SHALL attempt a single-query fallback to fetch both Top N entries and the current user's row, and SHALL fall back to the legacy double-query flow if the single query fails.

#### Scenario: Single query succeeds

- **WHEN** a signed-in user requests the leaderboard
- **THEN** the backend SHALL fetch rows matching `rank between offset+1 and offset+limit OR is_me = true` in one query
- **AND** the response payload SHALL remain unchanged

#### Scenario: Single query fails

- **WHEN** the single-query attempt fails
- **THEN** the backend SHALL fall back to the legacy `entries + me` queries

### Requirement: Matrix rain rendering is GPU-budgeted

The UI SHALL render the Matrix rain animation with a capped update rate and reduced internal render resolution, and SHALL pause rendering when the document is hidden, so steady-state GPU usage remains below 2% on the reference device.

#### Scenario: Visible page uses capped update rate and scaled buffer

- **WHEN** a user views the dashboard or landing page with Matrix rain enabled
- **THEN** the renderer SHALL cap updates to `<= 12 fps`
- **AND** the internal render buffer SHALL be scaled to `<= 60%` of the viewport on each axis

#### Scenario: Hidden document pauses rendering

- **WHEN** the document visibility state becomes `hidden`
- **THEN** the renderer SHALL stop scheduling animation frames until it becomes visible again

#### Scenario: GPU budget holds on reference device

- **GIVEN** the reference device environment (macOS + Chrome Task Manager GPU process)
- **WHEN** the page is idle in the foreground for 60 seconds
- **THEN** steady-state GPU usage SHALL remain `<= 2%` on average

### Requirement: Hourly usage aggregation prefers DB-side grouping

The system SHALL attempt database-side hourly aggregation for `GET /functions/vibeusage-usage-hourly` when the request uses UTC time, and SHALL fall back to row-level aggregation if the database aggregation is unavailable.

#### Scenario: DB aggregation succeeds

- **WHEN** a signed-in user requests hourly usage in UTC
- **THEN** the endpoint SHALL return hourly buckets aggregated by database-side grouping
- **AND** the response payload shape SHALL remain unchanged

#### Scenario: DB aggregation unsupported

- **WHEN** the database aggregation attempt fails
- **THEN** the endpoint SHALL fall back to the legacy aggregation path without changing response fields

### Requirement: Monthly usage aggregation prefers DB-side grouping

The system SHALL attempt database-side monthly aggregation for `GET /functions/vibeusage-usage-monthly` when the request uses UTC time, and SHALL fall back to row-level aggregation if the database aggregation is unavailable.

#### Scenario: DB aggregation succeeds

- **WHEN** a signed-in user requests monthly usage in UTC
- **THEN** the endpoint SHALL return monthly buckets aggregated by database-side grouping
- **AND** the response payload shape SHALL remain unchanged

#### Scenario: DB aggregation unsupported

- **WHEN** the database aggregation attempt fails
- **THEN** the endpoint SHALL fall back to the legacy aggregation path without changing response fields

### Requirement: UTC daily rollup is maintained from hourly buckets when enabled

When rollup aggregation is enabled and the rollup table is deployed, the system SHALL maintain a UTC daily rollup keyed by `user_id + day + source + model`, derived from `vibeusage_tracker_hourly`. Rollup updates MUST be idempotent and replayable.

#### Scenario: Hourly upsert updates rollup totals

- **GIVEN** rollup aggregation is enabled
- **AND** an hourly bucket upsert for a user
- **WHEN** the row is inserted or updated
- **THEN** the daily rollup for the corresponding UTC day SHALL reflect the delta

### Requirement: Usage summary prefers rollup aggregation when enabled

The system MUST prefer rollup aggregation for `usage-summary` when rollup aggregation is enabled and MUST fall back to hourly aggregation if rollup data is unavailable or rollup is disabled.

#### Scenario: Rollup unavailable

- **GIVEN** rollup data is missing or unavailable
- **WHEN** a user requests usage summary
- **THEN** the endpoint SHALL fall back to hourly aggregation without changing response fields

#### Scenario: Rollup disabled

- **GIVEN** rollup aggregation is disabled
- **WHEN** a user requests usage summary
- **THEN** the endpoint SHALL use hourly aggregation without changing response fields

### Requirement: Usage day-range endpoints enforce maximum range

The system SHALL reject usage requests that exceed a maximum day range for `GET /functions/vibeusage-usage-summary`, `GET /functions/vibeusage-usage-daily`, and `GET /functions/vibeusage-usage-model-breakdown`. The maximum day range SHALL default to 800 days and be configurable via `VIBEUSAGE_USAGE_MAX_DAYS`.

#### Scenario: 24-month window succeeds by default

- **WHEN** a client calls `GET /functions/vibeusage-usage-summary?from=2024-02-01&to=2026-01-01`
- **THEN** the endpoint SHALL respond with `200`
- **AND** the response SHALL follow the existing contract

#### Scenario: Oversized range is rejected

- **WHEN** a client calls `GET /functions/vibeusage-usage-summary?from=2023-01-01&to=2026-01-01`
- **THEN** the endpoint SHALL respond with `400`
- **AND** the response SHALL include the maximum allowed day range

#### Scenario: Env override enforces smaller cap

- **GIVEN** `VIBEUSAGE_USAGE_MAX_DAYS=30`
- **WHEN** a client calls `GET /functions/vibeusage-usage-daily?from=2025-01-01&to=2025-02-15`
- **THEN** the endpoint SHALL respond with `400`

### Requirement: Dashboard deduplicates usage-daily requests

The dashboard MUST avoid issuing redundant `GET /functions/vibeusage-usage-daily` calls for the same `from/to/tz` window within a single refresh cycle.

#### Scenario: Week period reuses daily rows

- **GIVEN** `period=week`
- **WHEN** the dashboard renders the daily table and trend chart
- **THEN** it SHALL issue at most one `usage-daily` request for that window
- **AND** the trend chart SHALL reuse the daily rows already fetched

### Requirement: Usage daily returns backend summary

`GET /functions/vibeusage-usage-daily` SHALL include a backend-computed `summary` object so the dashboard does not compute totals locally.

#### Scenario: Daily response includes summary

- **WHEN** a user requests usage daily for any range
- **THEN** the response SHALL include `summary.totals` with token totals

### Requirement: Summary is backend-derived when daily rows exist

When daily rows are already fetched (i.e., `period!=total`), the dashboard MUST use backend-provided totals and MUST NOT compute summary locally.

#### Scenario: Month period uses backend summary

- **GIVEN** `period=month`
- **WHEN** the dashboard refreshes usage data
- **THEN** it SHALL use backend summary totals
- **AND** it SHALL NOT compute summary from daily rows on the client

### Requirement: OpenCode local usage parsing is SQLite-first

The CLI SHALL treat `~/.local/share/opencode/opencode.db` (or `OPENCODE_HOME/opencode.db`) as the current authoritative OpenCode local usage source. Legacy message JSON files MAY still be parsed when present, but SQLite-backed usage MUST be included when the database exists.

#### Scenario: Sync reads OpenCode SQLite data without legacy message files

- **GIVEN** an OpenCode home that contains `opencode.db`
- **AND** the legacy message JSON directory is empty or absent
- **WHEN** a user runs `npx vibeusage sync`
- **THEN** the CLI SHALL still parse OpenCode local usage from SQLite
- **AND** it SHALL aggregate tokens using the same half-hour bucket model as other local sources

#### Scenario: OpenCode project attribution uses project worktree

- **GIVEN** an OpenCode SQLite message row linked through `session.project_id`
- **WHEN** the tracker attributes project-scoped usage
- **THEN** it SHALL resolve the project path from `project.worktree`
- **AND** it SHALL NOT infer the project path from legacy message file locations

### Requirement: Auto sync health is diagnosable

The CLI SHALL expose sufficient diagnostics to determine whether auto sync is functioning, degraded, or failing. This output MUST include OpenCode SQLite reader health when OpenCode support is enabled.

#### Scenario: User validates auto sync health

- **WHEN** a user runs `npx vibeusage status --diagnostics`
- **THEN** the output SHALL include the latest notify timestamp, last notify-triggered sync timestamp, queue pending bytes, upload throttle state, and any scheduled auto retry state
- **AND** it SHALL include an `opencode` diagnostics block with the SQLite DB path, DB presence, SQLite reader status, last SQLite check time, cursor update time, and last SQLite error code

#### Scenario: Doctor surfaces degraded OpenCode SQLite support

- **WHEN** a user runs `npx vibeusage doctor --json`
- **THEN** the report SHALL include a non-critical `opencode.sqlite_support` check
- **AND** `missing-db` or `never_checked` SHALL map to `warn`
- **AND** `missing-sqlite3` or `query-failed` SHALL map to `fail`
- **AND** degraded OpenCode SQLite support SHALL NOT increase `summary.critical`

### Requirement: Usage endpoints accept dashboard timezone

The system SHALL allow the dashboard to request usage aggregates in a specified timezone using `tz` (IANA) or `tz_offset_minutes` (fixed offset). When timezone parameters are omitted, usage endpoints SHALL default to UTC behavior.

#### Scenario: Dashboard requests local daily aggregates

- **GIVEN** a signed-in user
- **WHEN** the dashboard calls `GET /functions/vibeusage-usage-daily?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=America/Los_Angeles`
- **THEN** the response `day` keys SHALL align to the requested local calendar dates
- **AND** missing local days SHALL be represented as zero activity

### Requirement: Usage summary includes total cost

The system SHALL return `total_cost_usd` in the usage summary response, computed from token totals using a pricing profile. The computation MUST avoid double-counting cached input and reasoning output tokens by treating them as subcategories of input and output, respectively. The response SHALL include pricing metadata indicating the model, pricing mode, and rates used.

#### Scenario: Summary response includes cost and pricing basis

- **WHEN** a user requests `GET /functions/vibeusage-usage-summary` for a date range
- **THEN** the response SHALL include `totals.total_cost_usd` as a string
- **AND** the response SHALL include pricing metadata (`model`, `pricing_mode`, `rates`)
- **AND** cached input tokens SHALL be billed at cached rates without being billed again as full input tokens

### Requirement: Dashboard shows cost only in total summary

The dashboard SHALL display usage cost only in the total summary for day/week/month/total views, and SHALL NOT display per-day or per-month cost rows.

#### Scenario: Daily and monthly views show cost only in summary

- **WHEN** a signed-in user views day, week, or month usage
- **THEN** cost SHALL appear only in the total summary
- **AND** daily or monthly rows SHALL NOT show cost values

### Requirement: Spec compliance evidence map

The project SHALL maintain a requirement-to-evidence map for the `vibeusage-tracker` capability, listing the implementation location(s) and the verification step(s) for each requirement.

#### Scenario: Evidence map is available

- **GIVEN** a requirement exists in the `vibeusage-tracker` spec
- **WHEN** a reviewer inspects the compliance record
- **THEN** the record SHALL list the corresponding code location(s) and a repeatable verification step

### Requirement: Landing page serves static social metadata

The dashboard landing page HTML SHALL include Open Graph and Twitter card metadata in the initial HTML response, without requiring client-side JavaScript execution. The metadata values SHALL be sourced from the copy registry `landing.meta.*`, and `og:url` SHALL be `https://www.vibeusage.cc`.

#### Scenario: Crawler reads static meta tags

- **GIVEN** the dashboard is built via `npm --prefix dashboard run build`
- **WHEN** a crawler fetches `dashboard/dist/index.html`
- **THEN** the HTML SHALL include `meta` tags for `description`, `og:title`, `og:description`, `og:image`, `og:site_name`, `og:type`, `og:url`, `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
- **AND** the `content` values SHALL match the copy registry `landing.meta.*` entries
- **AND** `og:url` SHALL equal `https://www.vibeusage.cc`

### Requirement: Dashboard landing page Lighthouse performance (desktop)

The dashboard landing page at `http://localhost:5173/` SHALL achieve a Lighthouse Performance score of at least 95 on desktop, measured as the median of three runs using the default Lighthouse desktop preset.

#### Scenario: Desktop Lighthouse audit on landing page (local)

- **WHEN** Lighthouse is run three times with the default desktop preset against `http://localhost:5173/`
- **THEN** the median Performance score SHALL be ≥ 95

### Requirement: Signed-in dashboard Lighthouse performance (desktop)

The signed-in dashboard at `http://localhost:5173/` SHALL achieve a Lighthouse Performance score of at least 95 on desktop, measured as the median of three runs using the default Lighthouse desktop preset in an authenticated or mock session.

#### Scenario: Desktop Lighthouse audit on signed-in dashboard (local)

- **GIVEN** a valid authenticated session is present in the browser storage OR mock mode is enabled with `?mock=1`
- **WHEN** Lighthouse is run three times with the default desktop preset against `http://localhost:5173/`
- **THEN** the median Performance score SHALL be ≥ 95

### Requirement: Dashboard DETAILS table matches selected period granularity

The dashboard UI SHALL render the DETAILS table with a date/time column that matches the selected period.

#### Scenario: Day period shows hourly rows

- **WHEN** the user selects `day`
- **THEN** the DETAILS table SHALL render hourly buckets for that day
- **AND** the table SHALL paginate at 12 rows per page

#### Scenario: Week or month period shows daily rows

- **WHEN** the user selects `week` or `month`
- **THEN** the DETAILS table SHALL render daily buckets for the selected range

#### Scenario: Total period shows monthly rows with pagination

- **WHEN** the user selects `total`
- **THEN** the DETAILS table SHALL render monthly buckets for the latest 24 months
- **AND** the table SHALL paginate at 12 months per page

### Requirement: Dashboard DETAILS trims months before first non-zero usage for total

The dashboard UI SHALL NOT display future buckets and SHALL trim leading months before the first non-zero usage month in DETAILS for the `total` period. The `day` period SHALL continue to show missing or zero buckets.

#### Scenario: Total trims months before first non-zero usage

- **GIVEN** monthly DETAILS rows where the first non-zero month is `2025-10`
- **WHEN** the DETAILS table renders
- **THEN** months earlier than `2025-10` SHALL NOT be displayed

#### Scenario: Day keeps missing buckets

- **GIVEN** hourly DETAILS rows with `missing=true` buckets on the selected day
- **WHEN** the DETAILS table renders
- **THEN** those buckets SHALL remain visible with the existing unsynced label

### Requirement: Dashboard DETAILS sorting defaults to newest-first with active indicator

The dashboard UI SHALL default the DETAILS table date/time sorting to newest-first and SHALL show a sort indicator only on the active column.

#### Scenario: Default date sort is newest-first

- **GIVEN** the user opens the dashboard DETAILS table
- **THEN** the date/time column SHALL be sorted with the newest bucket first

#### Scenario: Sort indicators appear only on the active column

- **WHEN** the user views the DETAILS table header row
- **THEN** only the active column SHALL show a visible sort indicator

### Requirement: Leaderboard is served from precomputed snapshots

The system SHALL compute leaderboard rankings from a precomputed snapshot that is refreshed asynchronously.

#### Scenario: Leaderboard reads from latest snapshot

- **GIVEN** a snapshot exists for `period=week` with `generated_at`
- **WHEN** a signed-in user calls `GET /functions/vibeusage-leaderboard?period=week&metric=all`
- **THEN** the response SHALL reflect the latest snapshot totals (`gpt_tokens`, `claude_tokens`, `total_tokens`)
- **AND** the response SHALL include the snapshot `generated_at`

### Requirement: Leaderboard snapshots are refreshable by authorized automation

The system SHALL expose a refresh endpoint that rebuilds the current UTC leaderboard snapshots and is restricted to service-role or project-admin callers.

#### Scenario: Automation refreshes leaderboard snapshots

- **GIVEN** a valid service-role or project-admin bearer token
- **WHEN** the caller sends `POST /functions/vibeusage-leaderboard-refresh`
- **THEN** the snapshots for `week` SHALL be regenerated
- **AND** the response SHALL include the refresh `generated_at` timestamp

### Requirement: Multi-source usage ingestion

The system SHALL accept an optional `source` field on half-hour bucket uploads. When `source` is missing or empty, the system SHALL default it to `codex` to preserve backward compatibility.

#### Scenario: Old client upload without source

- **GIVEN** a client uploads half-hour buckets without a `source`
- **WHEN** the ingest endpoint processes the payload
- **THEN** the stored rows SHALL use `source = "codex"`
- **AND** existing behavior SHALL remain unchanged

#### Scenario: New client upload with source

- **GIVEN** a client uploads half-hour buckets with `source = "every-code"`
- **WHEN** the ingest endpoint processes the payload
- **THEN** the stored rows SHALL use `source = "every-code"`

### Requirement: Multi-source deduplication

The system SHALL include `source` in the ingest deduplication key for half-hour buckets.

#### Scenario: Same hour across different sources

- **GIVEN** two uploads with the same `user_id`, `device_id`, and `hour_start`, but different `source`
- **WHEN** both are ingested
- **THEN** both rows SHALL be stored without collision

### Requirement: Usage queries support source filtering

Usage query endpoints SHALL accept an optional `source` filter. When omitted, the response SHALL aggregate across all sources to preserve current behavior.

#### Scenario: Query without source

- **WHEN** a user calls `GET /functions/vibeusage-usage-daily` without `source`
- **THEN** the response SHALL include totals aggregated across all sources

#### Scenario: Query with source

- **WHEN** a user calls `GET /functions/vibeusage-usage-daily?source=every-code`
- **THEN** the response SHALL include only rows from `source = "every-code"`

### Requirement: Pricing model aliases are supported

The system SHALL support alias mappings from `usage_model` to `pricing_model` with an `effective_from` date and a `pricing_source`.

#### Scenario: Alias hit resolves pricing model

- **GIVEN** a usage model has an active alias mapping
- **WHEN** the pricing resolver runs
- **THEN** it SHALL use the alias `pricing_model` for pricing lookup

### Requirement: Alias mappings are frozen by effective_from

The system MUST select the latest alias mapping not in the future for a given usage model.

#### Scenario: Resolver selects latest effective alias

- **GIVEN** alias rows with different `effective_from` dates
- **WHEN** the resolver uses a date in the past
- **THEN** it SHALL select the latest alias row not in the future

### Requirement: Pricing sync writes alias rows for unmatched usage models

The pricing sync job SHALL generate alias rows for usage models that do not match any OpenRouter pricing model by exact or suffix match, using vendor rules and the latest OpenRouter model.

#### Scenario: Unmatched usage model is aliased

- **GIVEN** a usage model `claude-opus-4-5-20251101`
- **WHEN** pricing sync runs
- **THEN** an alias row SHALL be written mapping to the latest OpenRouter `anthropic/*` model

### Requirement: Dry-run preview mode

The system SHALL provide a dry-run mode for `init` that reports planned changes without modifying local files.

#### Scenario: Dry-run makes no changes

- **GIVEN** a user runs `npx --yes vibeusage init --dry-run`
- **THEN** the CLI SHALL NOT write to local config or install hooks
- **AND** the output SHALL indicate a preview-only run

### Requirement: Dashboard auth redirects do not carry display identity

Loopback auth redirect payloads used by the dashboard MUST NOT carry display identity fields such as `name`. Redirects MAY carry authentication metadata required to complete auth, but display identity SHALL be resolved only from the current-user profile after authentication.

#### Scenario: Redirect payload excludes display name

- **GIVEN** the dashboard completes an auth redirect flow
- **WHEN** it builds a loopback redirect URL
- **THEN** the redirect payload SHALL omit `name`
- **AND** subsequent dashboard rendering SHALL resolve display identity from the authenticated user's profile

### Requirement: Claude Code plugin install is safe and reversible

The system SHALL configure Claude Code through a VibeUsage-managed local Claude marketplace and plugin installed by the official `claude plugin` CLI, without removing or modifying unrelated user hooks or plugins, and SHALL support removing the VibeUsage Claude plugin on uninstall.

#### Scenario: Existing unrelated Claude hooks are preserved

- **GIVEN** `~/.claude/settings.json` already defines unrelated Claude hooks
- **WHEN** a user runs `npx --yes vibeusage init`
- **THEN** the VibeUsage Claude plugin SHALL be installed and enabled
- **AND** unrelated Claude hooks SHALL remain unchanged

#### Scenario: Uninstall removes the VibeUsage Claude plugin only

- **GIVEN** the VibeUsage Claude plugin is installed
- **WHEN** a user runs `npx --yes vibeusage uninstall`
- **THEN** the VibeUsage Claude plugin SHALL be removed
- **AND** unrelated Claude hooks or plugins SHALL remain unchanged

### Requirement: Claude plugin preserves notify-driven auto sync

The system SHALL preserve the existing Claude notify-driven ingestion chain after migration to plugin-backed install: Claude `Stop` and `SessionEnd` events SHALL still invoke the repo-owned local `notify.cjs` bridge, and `sync --auto` SHALL remain responsible for half-hour upload throttling and deferred retries.

#### Scenario: Claude plugin still triggers notify bridge

- **GIVEN** the VibeUsage Claude plugin is installed
- **WHEN** Claude fires a `Stop` or `SessionEnd` event
- **THEN** the plugin SHALL invoke `notify.cjs --source=claude`

#### Scenario: Auto upload policy remains unchanged

- **GIVEN** Claude triggers the VibeUsage notify bridge repeatedly within the throttle window
- **WHEN** `sync --auto` runs
- **THEN** upload throttling and retry scheduling SHALL behave the same as before the plugin migration

### Requirement: Claude usage source of truth remains project JSONL

The system SHALL continue treating `~/.claude/projects/**/*.jsonl` as the source of truth for Claude token usage parsing. Claude plugin state, marketplace state, or plugin data directories MUST NOT become the source of truth for Claude token aggregates.

#### Scenario: Plugin state is not used as Claude usage storage

- **GIVEN** the VibeUsage Claude plugin is installed
- **WHEN** the user runs `npx --yes vibeusage sync`
- **THEN** Claude usage SHALL be parsed from `~/.claude/projects/**/*.jsonl`
- **AND** plugin-local state SHALL only be used for integration health or installation state

