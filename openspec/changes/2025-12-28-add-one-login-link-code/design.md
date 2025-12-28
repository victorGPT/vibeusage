## Context
Provide a single-login onboarding flow by issuing a short-lived link code to a logged-in Dashboard session and exchanging it during CLI `init`.

## Goals / Non-Goals
- Goals:
  - Reduce onboarding friction by avoiding a second login.
  - Maintain security with short-lived, single-use link codes.
- Non-Goals:
  - Cross-device sharing or long-lived tokens embedded in commands.

## Decisions
- Decision: Use a session-bound, single-use link code with TTL 10 minutes.
- Decision: Exchange is atomic and idempotent using a `request_id`.
- Decision: Store only hashes of link codes.

## Risks / Trade-offs
- Risk: Link code leaked via shell history -> mitigate with TTL + single-use.
- Risk: Race conditions on exchange -> mitigate with atomic transaction.

## Migration Plan
- Add DB table + exchange RPC.
- Update edge functions, CLI init, Dashboard UI.

## Open Questions
- None (TTL fixed at 10 minutes).
