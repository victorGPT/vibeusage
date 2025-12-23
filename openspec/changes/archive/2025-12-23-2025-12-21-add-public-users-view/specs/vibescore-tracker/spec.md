## ADDED Requirements

### Requirement: User JWT validation resolves users reliably
The system SHALL ensure user-JWT authentication can resolve user identity even when the auth table lives in the `auth` schema.

#### Scenario: Auth SDK can resolve the current user
- **GIVEN** `auth.users` exists and `public.users` is a view of `auth.users`
- **WHEN** a client calls a user-JWT endpoint (e.g., `GET /functions/vibescore-usage-summary`)
- **THEN** the auth layer resolves the user and the endpoint returns 200.
