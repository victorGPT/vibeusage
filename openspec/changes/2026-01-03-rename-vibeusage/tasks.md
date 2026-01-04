## 1. Implementation
- [ ] 1.1 Create mapping list for all public identifiers (domains, CLI, env vars, API paths, package names).
- [x] 1.2 Implement CLI alias + rename flow with 90-day compatibility (no warnings).
- [x] 1.3 Implement local storage migration: `~/.vibescore` -> `~/.vibeusage` with idempotent fallback.
- [x] 1.4 Implement API path rename: `/functions/vibeusage-*` with proxy from `/functions/vibescore-*`.
- [x] 1.5 Update dashboard + copy registry to VibeUsage branding.
- [x] 1.6 Update docs and specs for VibeUsage naming.

## 2. Verification
- [x] 2.1 Run unit tests covering mapping and migration.
- [ ] 2.2 Verify old CLI commands execute new logic.
- [ ] 2.3 Verify old and new API paths return identical responses.
- [ ] 2.4 Verify local migration is idempotent and non-destructive.
- [x] 2.5 Record commands and results in `verification-report.md`.
