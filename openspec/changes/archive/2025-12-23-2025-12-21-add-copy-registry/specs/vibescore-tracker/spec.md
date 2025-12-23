## ADDED Requirements

### Requirement: Web UI copy is managed by a registry
The system SHALL centralize all web UI text in a repository-hosted copy registry, and UI components SHALL reference copy via stable keys.

#### Scenario: Update copy without touching code
- **WHEN** a user updates a text value in the registry table
- **THEN** the corresponding UI text SHALL update without editing component code

#### Scenario: Copy is traceable to its module
- **WHEN** a copy entry is reviewed
- **THEN** it SHALL include module/page/component metadata to identify its origin
