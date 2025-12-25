## 1. Diagnostics
- [x] 1.1 Capture InsForge function logs and confirm Deno proxy errors.
- [x] 1.2 Confirm production dashboard network behavior via DevTools (usage endpoints timing out / 502).

## 2. Backend Recovery
- [x] 2.1 Re-deploy `vibescore-usage-*`, `vibescore-ingest`, and `vibescore-sync-ping` from `insforge-functions/`.
- [x] 2.2 Verify usage endpoints respond within the timeout window (summary/daily/heatmap).
- [x] 2.4 Verify ingest responds within the timeout window (write path).
- [x] 2.3 Avoid auth roundtrip in usage endpoints by reading JWT payload (fallback to auth on decode failure).

## 3. Client Resilience
- [x] 3.1 CLI: make `init` sync best-effort with a bounded timeout and explicit failure message.
- [x] 3.2 Dashboard: add request timeout and ensure loading exits with error or cached data.
- [x] 3.3 Tests: add or extend timeout-related coverage.

## 4. Verification
- [x] 4.1 Run tests: `node --test test/*.test.js`.
- [x] 4.2 Manual regression: `init` completes; dashboard usage loads or errors quickly.
- [x] 4.3 Update docs if new environment variables or behavior are introduced.
