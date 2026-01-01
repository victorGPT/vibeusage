## 1. Implementation
- [x] 1.1 Update default `VIBESCORE_USAGE_MAX_DAYS` to 800 in `insforge-src/shared/date.js`.
- [x] 1.2 Update docs (`BACKEND_API.md`, `openspec/specs/vibescore-tracker/spec.md`).
- [x] 1.3 Update or add unit tests for default max-day behavior.
- [x] 1.4 Rebuild `insforge-functions/` artifacts.

## 2. Verification
- [x] 2.1 Run unit tests (`npm test`).
- [ ] 2.2 Run acceptance check for 24-month range (200) and oversized range (400).
- [x] 2.3 Record regression statement.
