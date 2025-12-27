## Context
- Users currently authenticate twice (Dashboard login + CLI init browser auth).
- We need a secure, low-friction bootstrap that does not persist user JWTs in the CLI.

## Goals / Non-Goals
- Goals:
  - Provide a one-login bootstrap via a short-lived link code.
  - Keep device token issuance secure (hash-only storage).
  - Add a copyable install command with masked display in the dashboard.
- Non-Goals:
  - Long-lived tokens embedded in commands.
  - Cross-platform installers or deep OAuth integration.
  - Persisting user JWTs on the CLI.

## Module Brief
- Scope (IN):
  - `vibescore-link-code-issue` (signed-in user issues link code).
  - `vibescore-link-code-exchange` (redeem link code for device token).
  - CLI `init --link-code` support with fallback to browser auth.
  - Dashboard install panel masked display + copy button.
- Scope (OUT):
  - Full SSO or identity federation.
  - Token rotation UX.
- Interfaces:
  - `POST /functions/vibescore-link-code-issue` (Auth: `Bearer <user_jwt>`).
  - `POST /functions/vibescore-link-code-exchange` (Auth: none; body includes `link_code`, `device_name`, `platform`).
  - `public.vibescore_exchange_link_code(...)` (RPC, security definer; atomic claim + insert).
  - CLI flag: `--link-code <code>`.
- Data flow & constraints:
  - Server stores only `link_code` hash with `expires_at`, `used_at`, `user_id`.
  - Link code TTL = 10 minutes; single-use.
  - CLI never persists user JWT.
  - UI text uses copy registry; visible command is masked but copy uses full command.
- Non-negotiables:
  - No raw link code stored server-side.
  - Device token remains the only long-lived credential on CLI.
  - Copy registry governance must pass validation.
- Test strategy:
  - Unit: CLI args + masking logic.
  - Integration: Edge functions with mock DB.
  - Regression: `npm test` + copy registry validation.
  - Acceptance: synthetic script for link code exchange.
- Milestones:
  - See `docs/plans/2025-12-27-link-code-init/milestones.md`.
- Plan B triggers:
  - Link code exchange error rate > 5% in staged testing.
  - Missing service role key in edge runtime.
  - If triggered: disable link-code path and fall back to browser auth.
- Upgrade plan (disabled by default):
  - None.

## Decisions
- Decision: Add a dedicated link code table (`hash`, `expires_at`, `used_at`, `user_id`).
- Decision: Use two new endpoints for issue/exchange instead of overloading `vibescore-device-token-issue`.
- Decision: Exchange uses a DB RPC to atomically claim the link code and insert device/token rows.
- Decision: CLI falls back to browser auth on link-code failure (unless `--no-auth`).
- Decision: Dashboard displays masked command and provides a copy button that copies full command.

## Alternatives considered
- Embed device token directly in install command (rejected: long-lived secret leakage).
- Local-only callback flow (rejected: higher complexity and platform variance).
- Reuse `vibescore-device-token-issue` with link code in Authorization header (rejected: ambiguous auth mode).

## Risks / Trade-offs
- Non-idempotent exchange could fail mid-flight; mitigate by re-issuing codes.
- Link code leakage risk via shell history; mitigate with TTL + single-use.

## Migration Plan
- Add link code table + RLS policies.
- Deploy new edge functions.
- Release CLI + Dashboard updates.

## Open Questions
- None.
