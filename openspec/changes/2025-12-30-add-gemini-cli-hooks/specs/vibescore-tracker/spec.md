## ADDED Requirements
### Requirement: Gemini CLI SessionEnd hook install is safe and reversible
The system SHALL configure Gemini CLI `SessionEnd` command hooks in `settings.json` under `GEMINI_HOME` (default `~/.gemini`) to invoke the tracker notify handler with `--source=gemini`, while preserving existing hooks and allowing clean uninstall. Hook entries SHALL use `type = "command"` and a stable `name` to support enable/disable. The system SHALL set `tools.enableHooks = true` to ensure hooks execute.

#### Scenario: Existing Gemini hooks are preserved
- **GIVEN** Gemini `settings.json` contains `SessionEnd` hooks
- **WHEN** the user runs `npx @vibescore/tracker init`
- **THEN** the tracker `SessionEnd` command hook SHALL be added
- **AND** it SHALL include `type = "command"` and `name = "vibescore-tracker"`
- **AND** it SHALL match all `SessionEnd` reasons (`exit`, `clear`, `logout`, `prompt_input_exit`, `other`)
- **AND** `hooks.disabled` SHALL remain unchanged
- **AND** existing hooks SHALL remain unchanged

#### Scenario: Hooks are enabled for execution
- **GIVEN** Gemini `settings.json` has `tools.enableHooks = false` or missing
- **WHEN** the user runs `npx @vibescore/tracker init`
- **THEN** `tools.enableHooks` SHALL be set to `true`

#### Scenario: Uninstall removes only the tracker hook
- **GIVEN** the tracker hook is present alongside other Gemini hooks
- **WHEN** the user runs `npx @vibescore/tracker uninstall`
- **THEN** the tracker hook SHALL be removed
- **AND** other hooks SHALL remain

#### Scenario: Missing Gemini config is skipped
- **GIVEN** the `GEMINI_HOME` directory does not exist
- **WHEN** the user runs `npx @vibescore/tracker init`
- **THEN** the tracker SHALL skip Gemini hook install and continue without error

#### Scenario: Settings file absent but Gemini home exists
- **GIVEN** `GEMINI_HOME` exists but `settings.json` is missing
- **WHEN** the user runs `npx @vibescore/tracker init`
- **THEN** the tracker SHALL create `settings.json` with the tracker hook

### Requirement: Gemini notify source does not chain Codex notify
The notify handler SHALL treat `--source=gemini` as a non-chained source and MUST NOT invoke Codex or Every Code notify commands.

#### Scenario: Gemini notify invocation
- **WHEN** the notify handler runs with `--source=gemini`
- **THEN** it SHALL spawn `sync --auto` and exit `0`
- **AND** it SHALL NOT invoke Codex/Every Code notify commands
