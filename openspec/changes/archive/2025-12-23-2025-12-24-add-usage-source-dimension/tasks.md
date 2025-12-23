## 1. Implementation
- [x] 1.1 Add spec delta for usage source dimension
- [x] 1.2 Add DB migration to include `source` in hourly storage (default `codex`)
- [x] 1.3 Update ingest to normalize and persist `source`
- [x] 1.4 Update usage queries to accept `source` filter; aggregate across all sources when omitted
- [x] 1.5 Backfill or default source for historical rows

## 2. Tests
- [x] 2.1 Unit: ingest default `source=codex` when missing/empty
- [x] 2.2 Unit: dedupe includes `source`
- [x] 2.3 Integration: query with/without `source` returns expected rows
- [x] 2.4 Regression: old client upload path still succeeds

## 3. Docs
- [x] 3.1 Update `BACKEND_API.md` to document `source`
- [x] 3.2 Update evidence map if needed
