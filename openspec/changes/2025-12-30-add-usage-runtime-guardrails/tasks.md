## 1. Implementation
- [x] 1.1 Add slow-query logging utility (`logSlowQuery`) with env-driven threshold.
- [x] 1.2 Add max day-range validation for `usage-summary`, `usage-daily`, and `usage-model-breakdown`.
- [x] 1.3 Emit slow-query logs in usage endpoints (summary/daily/hourly/monthly/heatmap/model-breakdown).
- [x] 1.4 Update tests for range validation and slow-query logging.
- [x] 1.5 Rebuild `insforge-functions/` artifacts.
- [x] 1.6 Update docs (`BACKEND_API.md` / `openspec/project.md`) for new env vars and limits.

## 2. Verification
- [x] 2.1 Run unit tests (`npm test`).
- [x] 2.2 Run acceptance check for oversized ranges (script or curl).
- [ ] 2.3 Validate slow-query logs in InsForge runtime logs.
