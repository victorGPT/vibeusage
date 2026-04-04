## ADDED Requirements

### Requirement: OpenClaw accounting uses a sanitized local ledger

The system SHALL treat a VibeUsage-owned sanitized OpenClaw usage ledger as the only local accounting source for `source = "openclaw"`. VibeUsage MUST NOT parse OpenClaw session transcript files and MUST NOT use OpenClaw Gateway session usage logs for accounting.

#### Scenario: OpenClaw sync ignores transcript files

- **GIVEN** OpenClaw session transcript files exist under `~/.openclaw/agents/*/sessions/`
- **WHEN** `vibeusage sync --from-openclaw` runs
- **THEN** the accounting path SHALL read only the sanitized OpenClaw ledger
- **AND** no transcript file path SHALL be used as an OpenClaw usage source

#### Scenario: OpenClaw sync ignores Gateway logs for accounting

- **GIVEN** OpenClaw Gateway exposes session usage log APIs
- **WHEN** VibeUsage accounts for OpenClaw token usage
- **THEN** it SHALL use the sanitized local ledger instead of `sessions.usage.logs`
- **AND** Gateway session logs SHALL NOT be treated as an accounting source

### Requirement: OpenClaw sanitized events exclude content and secrets

The system SHALL persist only whitelisted non-content metadata and numeric usage fields for OpenClaw usage events. It MUST NOT persist or upload prompt text, assistant text, tool payload text, raw session keys, raw workspace paths, passwords, API keys, tokens, cookies, or other secret material.

#### Scenario: Forbidden fields are dropped before persistence

- **GIVEN** an OpenClaw plugin hook payload includes rich fields such as `assistantTexts`, `lastAssistant`, or raw `sessionKey`
- **WHEN** VibeUsage builds an OpenClaw usage event
- **THEN** the persisted event SHALL include only the approved schema fields
- **AND** all forbidden content-bearing or secret-bearing fields SHALL be absent

#### Scenario: Uploaded OpenClaw buckets remain content-free

- **GIVEN** OpenClaw usage events have been aggregated into half-hour buckets
- **WHEN** VibeUsage uploads `source = "openclaw"` usage buckets
- **THEN** the upload payload SHALL contain only bucket timestamps, source identity, and numeric token fields
- **AND** no OpenClaw content or secret field SHALL be present

### Requirement: OpenClaw integration is single-path and hard-cut

The system SHALL expose exactly one supported OpenClaw integration path: the sanitized OpenClaw plugin plus sanitized local ledger. The system MUST remove the legacy OpenClaw hook path, transcript repair, and synthetic fallback accounting instead of preserving them for backward compatibility.

#### Scenario: Operator surfaces show one OpenClaw path

- **GIVEN** a user runs `vibeusage status`, `vibeusage init`, or `vibeusage uninstall`
- **WHEN** the CLI renders OpenClaw integration state
- **THEN** it SHALL describe exactly one supported OpenClaw integration path
- **AND** it SHALL not advertise `openclaw-legacy`, transcript repair, or fallback totals support

#### Scenario: Repeated OpenClaw triggers stay idempotent without fallback math

- **GIVEN** the same OpenClaw turn triggers sync more than once
- **WHEN** VibeUsage processes the corresponding sanitized usage event more than once
- **THEN** the resulting OpenClaw usage accounting SHALL not duplicate token totals
- **AND** no synthetic previous-total fallback path SHALL be used to correct the totals

### Requirement: OpenClaw v1 avoids project attribution from raw paths

The first version of the sanitized OpenClaw ingress SHALL not derive project attribution from raw workspace paths and SHALL not upload any raw path-derived identity for OpenClaw usage.

#### Scenario: Workspace paths are not promoted into usage identity

- **GIVEN** OpenClaw hook context includes `workspaceDir`
- **WHEN** VibeUsage builds a sanitized OpenClaw usage event
- **THEN** the event SHALL not store the raw workspace path
- **AND** the event SHALL not derive or upload project attribution from that path in this change