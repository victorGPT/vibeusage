## MODIFIED Requirements

### Requirement: Initialization MUST work without service role secrets
`vibescore-device-token-issue` MUST be able to issue a device token using only `user_jwt` (accessToken) and database RLS, even when `SERVICE_ROLE_KEY`/`INSFORGE_SERVICE_ROLE_KEY` is not configured in the function runtime.

#### Scenario: CLI init succeeds without service role key
- **GIVEN** the edge function runtime has no `SERVICE_ROLE_KEY`
- **WHEN** the CLI calls `POST /functions/vibescore-device-token-issue` with a valid `Authorization: Bearer <user_jwt>`
- **THEN** the response is `200` and returns `{ device_id, token }`

### Requirement: Ingest MUST not depend on service role secrets
`vibescore-ingest` MUST accept `Authorization: Bearer <device_token>` and write events without requiring `SERVICE_ROLE_KEY`/`INSFORGE_SERVICE_ROLE_KEY`.

#### Scenario: Device token ingest works without service role key
- **GIVEN** the edge function runtime has no `SERVICE_ROLE_KEY`
- **WHEN** the client sends a valid device token with events payload to `POST /functions/vibescore-ingest`
- **THEN** events are inserted idempotently and the response reports `{ inserted, skipped }`

### Requirement: Device-token-based writes MUST be constrained by RLS
Database row-level security MUST ensure a request authenticated only by a device token can only write rows that belong to that token’s `(user_id, device_id)` binding.

#### Scenario: Cross-user insertion is rejected
- **GIVEN** a device token bound to `(user_id=A, device_id=DA)`
- **WHEN** an ingest attempt tries to insert an event with `user_id=B`
- **THEN** the database rejects the insert due to RLS
