## ADDED Requirements

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
