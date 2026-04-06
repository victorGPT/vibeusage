## MODIFIED Requirements

### Requirement: CLI installation and commands

The system SHALL provide a consent-driven, low-noise init experience that does not modify local files before explicit user confirmation (or explicit non-interactive override), and `init` SHALL remain the only command that mutates local AI CLI integration state.

#### Scenario: Transparency report after setup

- **WHEN** local setup completes
- **THEN** the CLI SHALL print a summary list of integrations updated or skipped
- **AND** Claude Code SHALL be reported using plugin terminology rather than hook terminology

## ADDED Requirements

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
