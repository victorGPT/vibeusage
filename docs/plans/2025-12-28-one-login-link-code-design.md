# One-Login Link Code Design

## Goal
Enable a single-login onboarding flow by letting a logged-in Dashboard session mint a short-lived, single-use link code that the CLI can exchange during installation.

## Scope
- In-scope: Link code generation, exchange, and CLI bootstrap from the current web session.
- Out-of-scope: Persistent auth tokens in URLs, long-lived secrets in CLI commands, cross-device sharing.

## Constraints
- Link code is bound to the current web session.
- TTL: 10 minutes.
- Single-use only (atomic exchange).
- User-facing copy must come from `dashboard/src/content/copy.csv`.

## Architecture
1. Dashboard requests a link code from the backend using the current session.
2. Dashboard renders an install command including the link code.
3. CLI runs `npx --yes @vibescore/tracker init --link-code <code>` and calls the exchange endpoint.
4. Backend validates and atomically exchanges the code for a CLI credential/device binding, then marks the code as used.

## Data Model
Table: `public.vibescore_link_codes`
- `id` (uuid pk)
- `code_hash` (text, unique)
- `session_id` (text)
- `expires_at` (timestamptz)
- `used_at` (timestamptz, nullable)
- `request_id` (text, nullable)
- `created_at` (timestamptz)

## Endpoints
- `POST /functions/vibescore-link-code-init` (user session)
  - Returns: `{ link_code, expires_at }`
- `POST /functions/vibescore-link-code-exchange` (cli init)
  - Input: `{ link_code, request_id }`
  - Output: `{ cli_token, user_id }`

## Exchange Rules
- Reject if `expires_at < now()`.
- Reject if `used_at IS NOT NULL` and `request_id` mismatches.
- If `used_at IS NOT NULL` and `request_id` matches, return same result (idempotent).
- On success, write `used_at` and bind CLI credential in the same transaction.

## Frontend UX
- Display masked user id (example: `usr_****1234`) but copy full value when needed.
- Provide a dedicated "Copy full command" button that copies the full CLI command.
- Copy/toast strings must be sourced from `dashboard/src/content/copy.csv`.

## Security & Privacy
- Store only `code_hash`, never raw link codes.
- Avoid logging raw codes; log `code_hash` only.
- Rate limit link code creation and exchange attempts.

## Error Handling
- Expired: prompt user to regenerate the command.
- Used: prompt user to regenerate the command.
- Invalid session: return generic invalid/expired error to avoid leakage.

## Testing Strategy
- Unit tests: command generation, masking vs copy behavior.
- Integration tests: exchange idempotency, single-use enforcement, expiry handling.
- Concurrency test: two simultaneous exchanges only yield one success.

## Principles
- Short-lived secrets only.
- Single-use tokens with atomic exchange.
- Minimal exposure in logs and UI.
