## 1. Implementation
- [x] 1.1 Update usage model normalization to preserve prefixes (lowercase only)
- [x] 1.2 Update `applyUsageModelFilter` to strict match (remove suffix expansion)
- [x] 1.3 Adjust usage endpoints to align with strict model semantics + explicit alias expansion
- [x] 1.4 Ensure pricing resolution respects explicit alias only for prefixed models

## 2. Tests
- [x] 2.1 Add/update unit tests for `normalizeUsageModel` and `applyUsageModelFilter`
- [x] 2.2 Add/update edge-function tests for strict model filter and alias expansion
- [x] 2.3 Add/update pricing resolution tests for prefixed models without aliases

## 3. Docs
- [x] 3.1 Update API docs for `model` parameter strict semantics
- [x] 3.2 Record regression verification commands/results

## Verification
- `node --test test/insforge-src-shared.test.js test/edge-functions.test.js` (PASS)
- `npm test` (PASS)

