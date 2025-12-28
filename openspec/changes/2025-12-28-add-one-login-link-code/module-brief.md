# Module Brief: One-Login Link Code

## Scope
- IN: session-bound link code issuance, single-use exchange for CLI init, CLI `--link-code` handling, dashboard install command + copy UI.
- OUT: cross-device sharing, long-lived secrets in commands, payment or usage pipeline changes.

## Interfaces
- Input: Dashboard session (user JWT), link code + `request_id` from CLI.
- Output: device token + device id from exchange; install command string in UI.

## Data Flow and Constraints
- Link code TTL: 10 minutes.
- Link code bound to the current session.
- Exchange is atomic and idempotent by `request_id`.
- Store only code hashes, never raw codes.
- UI copy must come from `dashboard/src/content/copy.csv`.

## Non-Negotiables
- No long-lived credentials embedded in CLI commands.
- No raw link code stored or logged.
- Reuse with different `request_id` must be rejected.
- Exchange must be single-transaction to prevent double-issue.

## Test Strategy
- Unit: UI masking and copy command composition.
- Integration: link code init/exchange, expiry, idempotency.
- Regression: CLI `init` without link code still works.

## Milestones
- M1: OpenSpec + planning artifacts approved.
- M2: Backend schema + functions + tests.
- M3: CLI + Dashboard updates + tests.
- M4: Regression verification + PR gate evidence.

## Plan B Triggers
- If session binding is unavailable in edge runtime, fallback to server-side session lookup via RPC with service role.

## Upgrade Plan (disabled)
- Optional future: device authorization flow (CLI shows code, web approves).
