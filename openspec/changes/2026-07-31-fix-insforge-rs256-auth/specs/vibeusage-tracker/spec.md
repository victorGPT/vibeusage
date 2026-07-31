## ADDED Requirements

### Requirement: Edge functions verify user JWT signatures

Edge functions SHALL cryptographically verify every bearer token before deriving a user identity from it. RS256 tokens SHALL be verified against the public key published at `/.well-known/jwks.json`, selected by the token's `kid`. HS256 tokens SHALL be verified against the configured shared secret. A token whose signature cannot be verified SHALL be rejected with HTTP 401.

#### Scenario: RS256 token verified against JWKS

- **WHEN** a request presents a bearer token with header `alg: RS256` and a `kid` published in JWKS
- **AND** the signature verifies against that key
- **THEN** the function SHALL derive the user id from the `sub` claim and serve the request

#### Scenario: Forged signature rejected

- **WHEN** a request presents a well-formed JWT whose signature does not verify
- **THEN** the function SHALL respond HTTP 401
- **AND** SHALL NOT create an edge client or issue any database query

#### Scenario: Unknown signing key rejected

- **WHEN** a request presents an RS256 token whose `kid` is absent from JWKS
- **THEN** the function SHALL respond HTTP 401

#### Scenario: Missing shared secret is not a bypass

- **WHEN** no `INSFORGE_JWT_SECRET` is configured
- **AND** a request presents an HS256 token
- **THEN** the function SHALL respond HTTP 401 rather than trusting the token's unverified claims

#### Scenario: JWKS resolved from the project host

- **WHEN** a function resolves the JWKS endpoint
- **THEN** it SHALL derive the URL from the configured project base URL
- **AND** SHALL NOT derive it from the incoming request origin, which would make the deployment fetch itself

## REMOVED Requirements

### Requirement: Dashboard resolves edge function path compatibility

**Reason**: `/api/functions/{slug}` is the admin management API, not an invocation route. Falling back to it on HTTP 404 caused a backend outage to be reported to users as `Admin access required`, hiding the real failure and lengthening diagnosis.

**Migration**: The dashboard calls `/functions/{slug}` only. An HTTP 404 from that path now propagates to the caller unchanged.
