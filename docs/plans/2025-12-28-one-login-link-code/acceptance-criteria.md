# Acceptance Criteria

## Feature: One-login link code install

### Requirement: Dashboard issues a short-lived link code bound to the current session
- Rationale: Avoid a second login during CLI install.

#### Scenario: Link code issuance
- WHEN a logged-in user requests the install command
- THEN the system SHALL return a link code with a 10-minute TTL bound to the current session
- AND the raw link code SHALL NOT be stored (hash only)

### Requirement: Link code exchange is atomic and idempotent
- Rationale: Prevent double-claiming and allow safe retries.

#### Scenario: Successful exchange
- WHEN the CLI submits a valid, unexpired link code with a `request_id`
- THEN the system SHALL return a device credential
- AND the link code SHALL be marked as used in the same transaction

#### Scenario: Idempotent retry
- WHEN the CLI repeats the exchange with the same `request_id`
- THEN the system SHALL return the same result without creating a second device token
- AND the link code SHALL remain marked as used

#### Scenario: Reuse with different request id
- WHEN the CLI submits the same link code with a different `request_id`
- THEN the system SHALL reject the exchange as already used
- AND no new device token SHALL be created

### Requirement: Install command copy uses full data while UI masks sensitive identifiers
- Rationale: Maintain usability while reducing on-screen exposure.

#### Scenario: Copy full command
- WHEN the user clicks the "copy full command" button
- THEN the clipboard SHALL contain the full CLI command with the link code
- AND the UI message SHALL come from `dashboard/src/content/copy.csv`

#### Scenario: Masked user identifier
- WHEN the user id is shown on screen
- THEN it SHALL be masked (e.g., `usr_****1234`)
- AND copying user id (if provided) SHALL still use the full value

### Requirement: Expired link codes are rejected with a regenerate path
- Rationale: Prevent stale or leaked codes from being used.

#### Scenario: Expired link code
- WHEN the CLI submits a link code past its TTL
- THEN the system SHALL reject the request as invalid or expired
- AND the UI SHALL guide the user to regenerate the install command
