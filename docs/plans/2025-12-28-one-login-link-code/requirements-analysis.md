# Requirement Analysis

## Goal
- Reduce onboarding friction by enabling a single-login flow: logged-in Dashboard session issues a short-lived link code for CLI install.

## Scope
- In scope:
  - Link code issuance bound to current session.
  - CLI exchange of link code during `init`.
  - One-time use + TTL enforcement.
  - Dashboard UI updates for install command and copy.
- Out of scope:
  - Cross-device sharing or long-lived tokens in commands.
  - Any changes to payment, usage analytics, or non-auth CLI commands.

## Users / Actors
- Dashboard user (logged-in).
- CLI installer running `npx --yes @vibescore/tracker init`.
- Backend (InsForge edge functions + DB).

## Inputs
- Authenticated Dashboard session.
- Link code (single-use, TTL 10 minutes).
- CLI `request_id` for idempotency.

## Outputs
- CLI credential/device binding (token + device_id).
- Install command string with link code.

## Business Rules
- Link code MUST be bound to the current session.
- Link code MUST be single-use and expire after 10 minutes.
- Exchange MUST be atomic and idempotent via `request_id`.
- Raw link codes MUST NOT be stored; only hashes.
- User-facing copy MUST come from `dashboard/src/content/copy.csv`.

## Assumptions
- CLI `init` can accept a `--link-code` parameter.
- Existing device token issuance remains the source of truth.

## Dependencies
- InsForge database for link code storage.
- Edge functions for init/exchange.
- Dashboard copy registry.

## Risks
- Link code leakage via shell history/logs; mitigated by short TTL and single-use.
- Concurrency causing double exchange; mitigated by atomic exchange.
- User confusion on expiry; mitigated by clear UI messaging.
