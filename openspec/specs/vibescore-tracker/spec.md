# Spec: vibescore-tracker

## Purpose

Provide a safe, idempotent token-usage tracker for Codex CLI, backed by an InsForge backend and a web dashboard for viewing usage.
## Requirements
### Requirement: CLI installation and commands
The system SHALL provide a CLI package `@vibescore/tracker` with commands `init`, `sync`, `status`, and `uninstall`.

#### Scenario: CLI help is discoverable
- **WHEN** a user runs `npx @vibescore/tracker --help`
- **THEN** the output SHALL include `init`, `sync`, `status`, and `uninstall`

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
The system SHALL incrementally parse `~/.codex/sessions/**/rollout-*.jsonl` and MUST only extract token usage from `payload.type == "token_count"` using an explicit allowlist of numeric fields.

#### Scenario: Parser ignores non-token_count records
- **GIVEN** a rollout file contains non-`token_count` records (including conversational content)
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** only `token_count`-derived numeric fields SHALL be queued for upload
- **AND** no conversational content SHALL be persisted or uploaded

### Requirement: Client-side idempotency
The system MUST be safe to re-run. Upload retries and repeated `sync` executions MUST NOT double-count usage in the cloud.

#### Scenario: Re-running sync does not duplicate events
- **GIVEN** a user ran `npx @vibescore/tracker sync` successfully once
- **WHEN** the user runs `npx @vibescore/tracker sync` again without new Codex events
- **THEN** the ingest result SHOULD report `0` inserted events (or otherwise indicate no new events)

### Requirement: Device token authentication boundary
The ingest API MUST authenticate devices using a long-lived device token, and MUST NOT require the CLI to store a user JWT long-term.

#### Scenario: CLI stores device token, not user JWT
- **WHEN** a user completes the browser auth flow during `init`
- **THEN** the CLI SHALL persist only the device token (and device id) for future ingestion
- **AND** the CLI SHALL NOT persist any user JWT long-term

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

#### Scenario: Heatmap is derived from UTC daily totals
- **GIVEN** the user is signed in
- **WHEN** the dashboard fetches daily totals for a rolling range (e.g., last 52 weeks)
- **THEN** the UI SHALL derive heatmap intensity levels (0..4) from `total_tokens` per UTC day
- **AND** missing days SHALL be treated as zero activity

### Requirement: Dashboard shows identity information from login state
The dashboard UI SHALL show an identity panel derived from the login state (name/email/userId). Rank MAY be shown as a placeholder until a backend rank endpoint exists.

#### Scenario: Identity panel uses auth fields
- **GIVEN** the user is signed in
- **WHEN** the dashboard renders the identity panel
- **THEN** it SHALL display `name` when available, otherwise fall back to `email`
- **AND** it MAY display `userId` as a secondary identifier

