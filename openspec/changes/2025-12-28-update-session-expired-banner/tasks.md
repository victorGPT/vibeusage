## 1. Planning
- [x] Confirm requirements & acceptance criteria in `docs/plans/2025-12-28-session-expired-banner/`
- [x] Confirm this change proposal is approved before code changes

## 2. Tests (TDD)
- [x] Add failing tests for session expired banner behavior
- [x] Verify tests fail for the expected reasons

## 3. Implementation
- [x] Add session expired storage helpers + event emitter
- [x] Mark session expired on 401 in `vibescore-api`
- [x] Update `use-auth` to track session expired and compute `signedIn`
- [x] Update `App` gating for LandingPage vs Dashboard
- [x] Add non-blocking banner to `DashboardPage`
- [x] Add copy registry keys for banner

## 4. Verification
- [x] Run `npm test`
- [x] Run `node scripts/validate-copy-registry.cjs`
- [x] Manual check: force 401 and confirm banner appears without full-page gate

## 5. Docs & Spec
- [x] Update spec delta under `openspec/changes/2025-12-28-update-session-expired-banner/specs/vibescore-tracker/spec.md`
- [x] Record verification report
