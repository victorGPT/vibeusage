# PR Template (Minimal)

## PR Goal (one sentence)
Prevent Opencode message rewrites from double counting token usage.

## Commit Narrative
- fix(rollout): track opencode message keys to prevent rewrite double count
- fix(rollout): fall back to legacy file totals when opencode state missing
- test(rollout): cover opencode message rewrite scenarios
- docs(pr): record regression command and result

## Regression Test Gate
### Most likely regression surface
- Opencode token usage parsing when messages are rewritten or re-saved.

### Verification method (choose at least one)
- [x] `node --test test/rollout-parser.test.js` => PASS

### Uncovered scope
- Full end-to-end ingestion with real Opencode storage replay.
