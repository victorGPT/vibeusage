## ADDED Requirements

### Requirement: PostgreSQL is the single source of truth for aggregates
The system SHALL treat PostgreSQL as the single source of truth for usage aggregates, and SHALL introduce any redundant storage only with explicit justification and rollback documentation.

#### Scenario: Redundant storage proposal
- **WHEN** a new cache or derived store for aggregates is proposed
- **THEN** the proposal SHALL document the primary source of truth and a rollback plan
- **AND** it SHALL include a measurable performance justification

### Requirement: Schema guardrails for new tables
The system SHALL apply PostgreSQL schema guardrails to new tables and columns to minimize long-term performance and correctness debt.

#### Scenario: New table or column is introduced
- **WHEN** a new schema element is added
- **THEN** timestamps SHALL use `timestamptz`
- **AND** money SHALL use `numeric`
- **AND** required fields SHALL be `NOT NULL` with defaults where appropriate
- **AND** foreign key columns SHALL be indexed

### Requirement: Least-privilege database access
The system SHALL enforce least-privilege access boundaries between clients and the database.

#### Scenario: Client reads data
- **WHEN** the dashboard or CLI needs data
- **THEN** it SHALL authenticate via user or device tokens
- **AND** it SHALL NOT use service-role credentials directly

### Requirement: Client SDK access is centralized
The system SHALL restrict InsForge SDK usage in client code to approved wrapper modules and SHALL prevent clients from referencing internal base URLs.

#### Scenario: Client module needs InsForge access
- **WHEN** the CLI or dashboard needs to call InsForge
- **THEN** it SHALL import SDK access only via `src/lib/insforge-client` or `dashboard/src/lib/insforge-client`
- **AND** it SHALL NOT reference `INSFORGE_INTERNAL_URL` directly
