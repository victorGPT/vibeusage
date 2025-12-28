## ADDED Requirements
### Requirement: Link code bootstrap for CLI init
The system SHALL allow CLI `init` to exchange a short-lived, single-use link code issued from a logged-in Dashboard session.

#### Scenario: Link code issuance is session-bound
- **WHEN** a logged-in user requests the CLI install command
- **THEN** the system SHALL issue a link code bound to the current session with a 10-minute TTL
- **AND** the system SHALL store only a hash of the link code

#### Scenario: CLI exchange succeeds once
- **WHEN** the CLI submits a valid, unexpired link code with a `request_id`
- **THEN** the system SHALL return a device token
- **AND** the link code SHALL be marked used in the same transaction

#### Scenario: Idempotent retry
- **WHEN** the CLI repeats the exchange with the same `request_id`
- **THEN** the system SHALL return the same result without creating a second device token

#### Scenario: Reuse or expired code is rejected
- **WHEN** the CLI submits an expired link code
- **THEN** the exchange SHALL be rejected
- **AND** when the CLI submits a used link code with a different `request_id`, the exchange SHALL be rejected
