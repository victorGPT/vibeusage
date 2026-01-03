## ADDED Requirements
### Requirement: Linux CLI support for Codex + Claude Code
The system SHALL support running `@vibescore/tracker` via npx on mainstream Linux distributions (Ubuntu/Fedora/Arch) with Node.js >= 18, and SHALL ensure `init`, `sync`, `status`, and `uninstall` operate for Codex CLI and Claude Code sources.

#### Scenario: Linux status runs without platform errors
- **GIVEN** a Linux environment with Node.js >= 18
- **WHEN** a user runs `npx --yes @vibescore/tracker status`
- **THEN** the CLI SHALL render status output without macOS-specific command failures
- **AND** it SHALL report Codex + Claude hook status when their configs exist

#### Scenario: Linux sync aggregates Codex + Claude logs
- **GIVEN** a Linux environment with Codex rollout JSONL and Claude project JSONL logs present
- **WHEN** a user runs `npx --yes @vibescore/tracker sync`
- **THEN** the CLI SHALL aggregate usage from Codex and Claude sources into UTC half-hour buckets

### Requirement: Claude home override for Linux
The system SHALL support a `CLAUDE_HOME` environment override for locating Claude Code configuration and logs. When set, `settings.json` and `projects/` SHALL be resolved under `CLAUDE_HOME`. When not set, the default base directory SHALL be `~/.claude`.

#### Scenario: CLAUDE_HOME overrides settings and projects path
- **GIVEN** `CLAUDE_HOME=/opt/claude`
- **WHEN** the user runs `npx --yes @vibescore/tracker init`
- **THEN** the CLI SHALL read and update `/opt/claude/settings.json` for hooks
- **AND** `sync` SHALL parse `/opt/claude/projects/**/*.jsonl` for Claude usage
