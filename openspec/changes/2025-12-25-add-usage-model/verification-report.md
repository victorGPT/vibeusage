# Verification Report

## Scope
- Model dimension for half-hour usage buckets (CLI + ingest + usage endpoints).

## Tests Run
- `node --test test/rollout-parser.test.js test/init-uninstall.test.js test/uploader.test.js`
- `node --test test/edge-functions.test.js`
- `node scripts/acceptance/ingest-duplicate-replay.cjs`
- `node scripts/acceptance/ingest-service-role-upsert.cjs`
- `node scripts/acceptance/ingest-batch-metrics.cjs`
- `node scripts/acceptance/usage-model-breakdown.cjs`

## Results
- Passed.

## Evidence
- Edge function tests include model filter coverage and ingest `on_conflict` key update.
- Acceptance outputs confirm ingest upsert, replay/idempotency, and usage model breakdown behavior.
- InsForge schema check confirms `vibescore_tracker_hourly.model` is non-null with default `unknown` and PK includes `model`.

## Remaining Risks
- Live data not re-validated in this run.
- Model cardinality may impact query performance under high volume.
