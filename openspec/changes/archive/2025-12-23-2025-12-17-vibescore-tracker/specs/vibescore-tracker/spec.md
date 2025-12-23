# Spec Delta: vibescore-tracker

## ADDED Requirements

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

