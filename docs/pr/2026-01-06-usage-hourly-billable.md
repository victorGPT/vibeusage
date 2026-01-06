# PR Template (Minimal)

## PR Goal (one sentence)
Prefer stored billable totals in the UTC aggregate path for hourly usage.

## Commit Narrative
- fix(usage-hourly): use sum(billable_total_tokens) when present in UTC aggregate
- fix(usage-hourly): fall back to computed billable when aggregate sum is partial
- test(usage-hourly): cover stored billable totals in aggregate path
- test(usage-hourly): cover partial aggregate billable fallback
- docs(pr): record regression command and result

## Regression Test Gate
### Most likely regression surface
- UTC hourly aggregate totals for billable tokens.

### Verification method (choose at least one)
- [x] `node --test test/edge-functions.test.js --test-name-pattern "prefers stored billable totals in aggregate path"` => PASS
- [x] `node --test test/edge-functions.test.js --test-name-pattern "aggregate path falls back when billable sums incomplete"` => PASS

### Uncovered scope
- End-to-end hourly aggregate against production data.
