# PR Template (Minimal)

## PR Goal (one sentence)
Show a non-blocking session-expired banner on Dashboard while keeping LandingPage for first-time unauth.

## Commit Narrative
- Commit 1: `feat(dashboard): add session expired banner`
- Commit 2: `docs: record manual verification`
- Commit 3: `style: highlight session expired banner`
- Commit 4: `style: restore green session banner border`
- Commit 5: `feat: add session-expired copy button`

## Rollback Semantics
- Reverting this PR restores the prior full-page auth gate behavior and removes the session-expired banner; no schema or backend changes involved.

## Hidden Context
- Session expiry is tracked via `localStorage["vibescore.dashboard.session_expired.v1"]`.
- Any 401 in `vibescore-api` sets the expiry flag; `signedIn` is suppressed while expired.

## Regression Test Gate
### Most likely regression surface
- Dashboard auth gating and top-of-page messaging.

### Verification method (choose at least one)
- [x] Existing automated tests did not fail (commands: `node --test test/dashboard-session-expired-banner.test.js`, `npm test`, `node scripts/validate-copy-registry.cjs` => PASS; copy registry warnings unchanged)
- [ ] New minimal test added (link or describe)
- [x] Manual regression path executed (local dev: set session_expired flag in localStorage, reload; banner appears, LandingPage does not)

### Uncovered scope
- Real cookie-based refresh expiry path against a deployed backend.

## Fast-Track (only if applicable)
- Statement: I manually verified the session-expired banner renders without blocking dashboard content.

## Notes
- High-risk modules touched: dashboard auth gating and session error handling.
