# Change: Stabilize leaderboard refresh automation

## Why
The GitHub Action "Refresh Leaderboard Snapshots" succeeded once and then failed repeatedly, leaving leaderboard snapshots stale. We need a reliable, observable refresh path so the leaderboard remains current and failures surface with actionable diagnostics.

## What Changes
- Add explicit per-period diagnostics (HTTP status + response body) in the automation logs.
- Align admin token usage so the workflow always sends the same value the refresh endpoint expects.
- Provide a manual resync runbook to bring snapshots current after the fix.
- Clarify required secrets and failure modes in documentation.

## Impact
- Affected specs: `vibescore-tracker` (leaderboard refresh automation requirement)
- Affected code: `.github/workflows/vibescore-leaderboard-refresh.yml`, docs/runbook, and possibly refresh endpoint diagnostics (if needed)
