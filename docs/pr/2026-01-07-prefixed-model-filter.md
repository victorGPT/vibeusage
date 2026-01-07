# PR Template (Minimal)

## PR Goal (one sentence)
Ensure prefixed model filters keep alias-mapped usage rows.

## Commit Narrative
- fix(usage): compare filter identity against alias-resolved identity for prefixed models
- test(usage-daily): cover prefixed model alias filter
- docs(pr): record regression command and result

## Regression Test Gate
### Most likely regression surface
- Prefixed model filters on usage daily/hourly/heatmap/monthly/summary.

### Verification method (choose at least one)
- [x] `node --test test/edge-functions.test.js -t "vibeusage-usage-daily prefixed model filter includes alias rows"` => PASS

### Uncovered scope
- End-to-end usage queries against live data.
