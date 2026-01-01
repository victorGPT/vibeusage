# Acceptance Criteria

## Feature: Lean Architecture & Data Guardrails

### Requirement: Maintain explicit module boundaries
- Rationale: Keep a small team productive by enforcing clear ownership and reducing coupling.

#### Scenario: CLI and Dashboard are decoupled from the database
- WHEN a client feature needs backend data
- THEN it SHALL call Edge Functions via SDK/HTTP
- AND it SHALL NOT access the database directly

### Requirement: Centralized client SDK access
- Rationale: Keep credentials centralized and reduce coupling across client modules.

#### Scenario: Client module needs InsForge access
- WHEN a CLI or dashboard module needs InsForge data
- THEN it SHALL use the approved `insforge-client` wrapper
- AND it SHALL NOT reference `INSFORGE_INTERNAL_URL` directly

### Requirement: PostgreSQL is the single source of truth
- Rationale: Reduce redundancy and operational cost while preserving data integrity.

#### Scenario: New storage path is proposed
- WHEN a new data store or cache is introduced
- THEN it SHALL document the primary source of truth and rollback plan
- AND it SHALL include measurable performance justification

### Requirement: Data minimization and privacy
- Rationale: Protect user privacy and reduce liability.

#### Scenario: Ingest receives payload data
- WHEN ingest processes payloads
- THEN only allowlisted numeric token fields SHALL be stored
- AND any non-allowlisted content SHALL be ignored or rejected

### Requirement: Schema safety rules for new tables
- Rationale: Prevent long-term schema and performance debt.

#### Scenario: A new table or column is added
- WHEN a new schema element is proposed
- THEN timestamps SHALL use `timestamptz`
- AND money SHALL use `numeric`
- AND required fields SHALL be `NOT NULL` with defaults where appropriate

### Requirement: Performance guardrails for reads
- Rationale: Avoid runaway query costs and latency.

#### Scenario: Usage queries execute
- WHEN a usage endpoint is called
- THEN it SHALL enforce maximum date ranges
- AND it SHALL prefer aggregate paths over row-level scans
