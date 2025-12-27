## ADDED Requirements
### Requirement: User status endpoint returns Pro status
The system SHALL provide `GET /functions/vibescore-user-status` for authenticated users and return the current Pro status, sources, and expiration.

#### Scenario: Registration-cutoff user receives Pro status
- **WHEN** a user with `created_at <= 2025-12-31T15:59:59Z` calls `GET /functions/vibescore-user-status`
- **THEN** the response SHALL include `pro.active = true`
- **AND** `pro.expires_at` SHALL equal `created_at + 99 years`

#### Scenario: Missing created_at falls back to server lookup
- **WHEN** the auth payload omits `created_at` and a service-role key is configured
- **THEN** the endpoint SHALL resolve `created_at` from `public.users`
- **AND** continue computing Pro status without returning an error

### Requirement: Pro status calculation uses cutoff and entitlements
The system MUST compute Pro status as `registration_cutoff OR active_entitlement`, where the registration cutoff is `2025-12-31T23:59:59` in `Asia/Shanghai` and an active entitlement is defined by the current UTC time in `[effective_from, effective_to)` with `revoked_at IS NULL`.

#### Scenario: Active entitlement grants Pro
- **WHEN** an entitlement exists with `effective_from <= now_utc < effective_to` and `revoked_at IS NULL`
- **THEN** the response SHALL include `pro.active = true`
- **AND** `pro.sources` SHALL include `entitlement`

### Requirement: Entitlements are time-bound and revocable
The system SHALL store entitlements with effective windows and revocation markers and SHALL treat revoked entitlements as inactive.

#### Scenario: Revoked entitlement is ignored
- **WHEN** an entitlement row has `revoked_at` set
- **THEN** it SHALL NOT contribute to `pro.active`

### Requirement: Entitlement management is admin-only
The system MUST restrict entitlement grant/revoke endpoints to service-role or project-admin callers.

#### Scenario: Non-admin callers are rejected
- **WHEN** a non-admin caller invokes `POST /functions/vibescore-entitlements`
- **THEN** the endpoint SHALL respond with `401` or `403`
