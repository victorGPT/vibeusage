## MODIFIED Requirements
### Requirement: Notify hook install is safe and reversible
The system MUST configure Codex CLI `notify` and, when `~/.code/config.toml` exists, Every Code `notify` without breaking existing user configuration, and MUST support restoring the previous `notify` configuration for each CLI.

#### Scenario: Existing Codex notify is preserved (chained)
- **GIVEN** `~/.codex/config.toml` already contains `notify = [...]`
- **WHEN** a user runs `npx @vibescore/tracker init`
- **THEN** the original Codex notify command SHALL still be invoked (chained) after the tracker notify handler

#### Scenario: Existing Every Code notify is preserved (chained)
- **GIVEN** `~/.code/config.toml` already contains `notify = [...]`
- **WHEN** a user runs `npx @vibescore/tracker init`
- **THEN** the original Every Code notify command SHALL still be invoked (chained) after the tracker notify handler

#### Scenario: Uninstall restores original notify for both CLIs
- **GIVEN** the tracker was installed via `init`
- **WHEN** a user runs `npx @vibescore/tracker uninstall`
- **THEN** `~/.codex/config.toml` SHALL be restored to the pre-install notify configuration (or notify removed if none existed)
- **AND** `~/.code/config.toml` SHALL be restored to the pre-install notify configuration (or notify removed if none existed)

### Requirement: Notify handler is non-blocking and safe
The notify handler MUST be non-blocking, MUST exit with status code `0` even on errors, and MUST NOT prevent Codex CLI from completing a turn. The handler SHALL chain the original notify for the invoking CLI based on an explicit source flag and SHALL avoid self-recursion.

#### Scenario: Every Code notify chains the correct original
- **GIVEN** `~/.code/config.toml` was configured with `--source=every-code`
- **WHEN** Every Code triggers the notify command
- **THEN** the handler SHALL chain the original Every Code notify (if present)
- **AND** SHALL NOT chain itself

## ADDED Requirements
### Requirement: Every Code notify auto-config is conditional
The system SHALL only attempt to configure Every Code `notify` when `~/.code/config.toml` exists (or when `CODE_HOME` points to a directory containing `config.toml`).

#### Scenario: Missing Every Code config is skipped
- **GIVEN** `~/.code/config.toml` does not exist
- **WHEN** a user runs `npx @vibescore/tracker init`
- **THEN** the tracker SHALL NOT create or modify `~/.code/config.toml`

#### Scenario: Existing Every Code config is updated
- **GIVEN** `~/.code/config.toml` exists
- **WHEN** a user runs `npx @vibescore/tracker init`
- **THEN** the tracker SHALL set `notify` to invoke the tracker handler with `--source=every-code`
