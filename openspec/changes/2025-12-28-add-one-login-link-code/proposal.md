# Change: One-login link code for CLI install

## Why
- Reduce onboarding friction by avoiding a second login during CLI installation.
- Keep security intact by using short-lived, single-use link codes.

## What Changes
- Add link code issuance bound to the current Dashboard session.
- Add link code exchange endpoint for CLI `init`.
- Add storage for link code hashes with TTL and single-use enforcement.
- Update Dashboard UI to render install command and copy button using copy registry.
- Update CLI `init` to accept `--link-code`.

## Impact
- Affected specs: `vibescore-tracker`.
- Affected code: `insforge-src/`, `dashboard/`, `src/` (CLI), `test/`.
- **BREAKING** (if any): None.

## Architecture / Flow
- Dashboard requests a link code with the current session.
- CLI exchanges link code during `init` for a device token.
- Exchange is atomic + idempotent; code is single-use and short-lived.

## Risks & Mitigations
- Link code leakage: short TTL (10 minutes) + single-use + hash-only storage.
- Double exchange: atomic transaction + idempotent `request_id`.

## Rollout / Milestones
- Add OpenSpec deltas + tasks.
- Implement backend endpoints and DB table.
- Update CLI + Dashboard, add tests.
- Verify regression paths and document evidence.
