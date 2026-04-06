## ADDED Requirements

### Requirement: Claude Code SessionEnd hook install is safe and reversible

The system SHALL configure a Claude Code user-level `SessionEnd` hook in `~/.claude/settings.json` to invoke the tracker notify handler, without removing or modifying other hooks, and SHALL support removing only the tracker hook on uninstall.

#### Scenario: Existing SessionEnd hooks are preserved

- **GIVEN** `~/.claude/settings.json` already defines `hooks.SessionEnd`
- **WHEN** a user runs `npx @vibescore/tracker init`
- **THEN** the tracker hook SHALL be added while existing hooks remain intact

#### Scenario: Uninstall removes only the tracker hook

- **GIVEN** the tracker hook is installed
- **WHEN** a user runs `npx @vibescore/tracker uninstall`
- **THEN** the tracker hook SHALL be removed and other hooks SHALL remain unchanged

### Requirement: Claude usage parsing from projects JSONL

The system SHALL incrementally parse `~/.claude/projects/**/*.jsonl` and MUST only extract token usage fields from `message.usage` (or top-level `usage` when present) (`input_tokens`, `output_tokens`, optional `cache_read_input_tokens`), aggregating into UTC half-hour buckets with `source = "claude"`. When `total_tokens` is not present, the client SHALL compute `total_tokens = input_tokens + output_tokens`.

#### Scenario: Missing output_tokens is treated as zero

- **GIVEN** a JSONL record includes `message.usage.input_tokens` but omits `output_tokens`
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** the bucket SHALL record `output_tokens = 0`

#### Scenario: total_tokens is derived from input + output

- **GIVEN** a JSONL record includes `message.usage.input_tokens` and `message.usage.output_tokens` but no `total_tokens`
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** the bucket SHALL record `total_tokens = input_tokens + output_tokens`

### Requirement: Claude hook command is non-blocking

The Claude hook command MUST be non-blocking and MUST NOT prevent Claude Code from completing a `SessionEnd` event.

#### Scenario: Hook errors do not block Claude

- **WHEN** the hook encounters an internal error
- **THEN** it SHALL still exit `0`
