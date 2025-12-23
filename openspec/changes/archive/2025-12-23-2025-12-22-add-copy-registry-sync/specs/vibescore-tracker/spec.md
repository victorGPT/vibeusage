## ADDED Requirements
### Requirement: Copy registry sync uses `origin/main` as the official source
The system SHALL provide a copy registry sync command that treats `origin/main:dashboard/src/content/copy.csv` as the authoritative source and displays which source was used for the operation.

#### Scenario: Pull shows the authoritative source
- **WHEN** a user runs `node scripts/copy-sync.cjs pull --dry-run`
- **THEN** the output SHALL indicate `origin/main:dashboard/src/content/copy.csv` as the source of truth

### Requirement: Pull is safe by default
The system SHALL make `pull` a dry-run by default, MUST avoid modifying `dashboard/src/content/copy.csv` unless explicitly confirmed, MUST create a local backup before any write, and SHALL present a diff preview for the copy registry.

#### Scenario: Pull dry-run does not write
- **GIVEN** local `dashboard/src/content/copy.csv` exists
- **WHEN** a user runs `node scripts/copy-sync.cjs pull --dry-run`
- **THEN** the file SHALL NOT be modified
- **AND** the script SHALL present a diff preview

### Requirement: Push is gated by validation and explicit confirmation
The system MUST validate the copy registry before push, MUST show a diff preview, MUST require an explicit confirmation flag to write or push updates, and SHALL auto-commit `copy.csv` when it is the only dirty file.

#### Scenario: Push is blocked without confirmation
- **GIVEN** the local copy registry passes validation
- **WHEN** a user runs `node scripts/copy-sync.cjs push --dry-run`
- **THEN** no write or remote push SHALL occur
- **AND** the script SHALL show the diff preview

#### Scenario: Push fails on validation errors
- **GIVEN** the local copy registry has schema errors
- **WHEN** a user runs `node scripts/copy-sync.cjs push --confirm`
- **THEN** the operation SHALL abort and report validation failures

#### Scenario: Push fails on dirty working tree
- **GIVEN** `git status` reports uncommitted changes outside `dashboard/src/content/copy.csv`
- **WHEN** a user runs `node scripts/copy-sync.cjs push --confirm`
- **THEN** the operation SHALL abort with a clear message

#### Scenario: Push auto-commits copy registry changes
- **GIVEN** `dashboard/src/content/copy.csv` is the only modified file
- **WHEN** a user runs `node scripts/copy-sync.cjs push --confirm`
- **THEN** the script SHALL create a commit for the copy registry change before any remote push
