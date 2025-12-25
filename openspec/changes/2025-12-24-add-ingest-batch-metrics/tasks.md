# Tasks

## 1. Implementation
- [x] 1.1 Add SQL to create `vibescore_tracker_ingest_batches` table + indexes.
- [x] 1.2 Update `vibescore-ingest` to write metrics (best-effort, non-blocking).
- [x] 1.3 Update retention function/workflow to purge ingest batch metrics (30 days).

## 2. Tests
- [x] 2.1 Add acceptance script `scripts/acceptance/ingest-batch-metrics.cjs` (records metrics on ingest).
- [x] 2.2 Add regression check: ingest succeeds even when metrics insert fails.

## 3. Verification
- [x] 3.1 Run acceptance script and record output.
- [x] 3.2 SQL check: per-minute metrics counts align with ingest requests.
- [x] 3.3 Verify retention removes metrics older than cutoff.
