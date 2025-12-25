## 1. Spec
- [x] Add usage model breakdown requirements to spec delta.
- [x] Validate change with `openspec validate 2025-12-25-add-usage-model-breakdown --strict`.

## 2. Backend Endpoint
- [x] Implement `insforge-src/functions/vibescore-usage-model-breakdown.js`.
- [x] Add grouping/cost helper (or reuse existing helpers) with unit tests or documented rationale.
- [x] Build `insforge-functions` output.
- [x] Deploy the edge function.

## 3. Docs & Verification
- [x] Update `BACKEND_API.md` and `docs/dashboard/api.md` with request/response examples.
- [x] Add regression runbook or script for the new endpoint.
- [x] Update verification report with evidence.
