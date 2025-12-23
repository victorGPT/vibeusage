## 1. Investigation
- [x] 1.1 Verify InsForge env keys (service role / anon key) and container restart signals
- [x] 1.2 Capture ingest logs during timeout windows (minute-aligned)

## 2. Ingest optimization
- [x] 2.1 Implement bulk insert with duplicate ignore for anon path (records API or RPC)
- [x] 2.2 Add regression script for duplicate-heavy batches (synthetic)
- [x] 2.3 Ensure idempotent replay remains correct (inserted/skipped)

## 3. CLI backpressure
- [x] 3.1 Tighten auto-sync backoff to honor Retry-After strictly
- [x] 3.2 Adjust batch/interval defaults to reduce burst (documented)

## 4. Dashboard probe reduction
- [x] 4.1 Increase backend probe interval (>= 60s)
- [x] 4.2 Pause probe when page is hidden (visibility API)

## 5. Documentation
- [x] 5.1 Update docs/runbook for troubleshooting + backpressure behavior
