## MODIFIED Requirements
### Requirement: CLI installation and commands
The system SHALL provide a consent-driven, low-noise init experience that does not modify local files before explicit user confirmation (or explicit non-interactive override).

#### Scenario: Consent gate before changes
- **GIVEN** an interactive terminal and no `--yes` flag
- **WHEN** a user runs `npx --yes @vibescore/tracker init`
- **THEN** the CLI SHALL display a privacy notice and a menu before any filesystem changes
- **AND** selecting Exit SHALL leave the filesystem unchanged

#### Scenario: Non-interactive init proceeds safely
- **GIVEN** stdin is not a TTY OR the user passes `--yes`
- **WHEN** a user runs `npx --yes @vibescore/tracker init`
- **THEN** the CLI SHALL proceed without prompting and still show the privacy notice

#### Scenario: Transparency report after setup
- **WHEN** local setup completes
- **THEN** the CLI SHALL print a summary list of integrations updated or skipped
- **AND** the CLI SHALL print a completion line (e.g., "Local configuration complete.")
- **AND** when account linking is required, the CLI SHALL print a clear transition line (e.g., "Next: Registering device...") before any browser-open instructions
- **AND** the CLI SHALL then show browser instructions with a manual fallback link, derived from the resolved dashboard URL

#### Scenario: Success message after account linking
- **GIVEN** account linking succeeds
- **WHEN** `init` finishes
- **THEN** the CLI SHALL render a success box that confirms linking
- **AND** the success box SHALL include the resolved dashboard URL for the user to open
