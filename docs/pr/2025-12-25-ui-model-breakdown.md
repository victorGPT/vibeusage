# PR Template (Minimal)

## PR Goal (one sentence)
Add the model breakdown map and cost analysis modal to the dashboard UI with API hook and copy entries.

## Commit Narrative
- feat(ui): add model breakdown UI components, hook, API wiring, and copy updates.
- docs(openspec): add the model UI change proposal and test/verification artifacts.
- docs(pr): add PR gate record for this change.

## Rollback Semantics
Reverting this PR removes the new UI components and hook, restoring the previous dashboard layout without data migrations.

## Hidden Context
- Model breakdown data is provided by backend aggregation; UI reads via `useUsageModelBreakdown`.
- All visible strings are sourced from `dashboard/src/content/copy.csv`.

## Regression Test Gate
### Most likely regression surface
- Dashboard render paths (usage panel + cost modal trigger).
- Copy registry validation for updated keys.

### Verification method (choose at least one)
- [x] Existing automated tests did not fail: `node scripts/validate-copy-registry.cjs`
- [ ] New minimal test added (link or describe)
- [ ] Manual regression path executed (steps + expected result)

### Uncovered scope
- Manual UI smoke (open dashboard, click cost info, view modal) not re-verified here.
- Expected not to affect non-dashboard pages; changes scoped to dashboard components.

## Fast-Track (only if applicable)
- Not applicable.

## Notes
- High-risk modules touched: none.
