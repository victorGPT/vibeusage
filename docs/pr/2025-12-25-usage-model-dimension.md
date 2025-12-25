# PR Template (Minimal)

## PR Goal (one sentence)
Add model dimension support to the usage pipeline and document the model breakdown endpoint.

## Commit Narrative
- Commit 1: `feat(backend): add model dimension support`
- Commit 2: `docs(openspec): update usage model change specs`
- Commit 3: `docs: add usage model PR gate and freeze record`

## Rollback Semantics
- Reverting this PR restores the previous usage schema without model dimension and removes related documentation/gates.

## Hidden Context
- Missing `model` values are normalized to `unknown`.

## Regression Test Gate
### Most likely regression surface
- Ingest idempotency keys, usage endpoint filters, and parser model extraction.

### Verification method (choose at least one)
- [x] Existing automated tests did not fail (commands: `node --test test/rollout-parser.test.js test/uploader.test.js test/edge-functions.test.js` => PASS (30 tests), `node scripts/acceptance/usage-model-breakdown.cjs` => PASS, `node scripts/acceptance/ingest-duplicate-replay.cjs` => PASS)
- [ ] New minimal test added (link or describe)
- [ ] Manual regression path executed (steps + expected result)

### Uncovered scope
- Migration runtime on large tables and live query latency under high cardinality.
- Live data validation for model filter usage.

## Fast-Track (only if applicable)
- Statement: I manually verified **X** behavior on **Y** path did not regress.

## Notes
- High-risk modules touched: schema migrations, ingest/queue pipeline, data writes.
