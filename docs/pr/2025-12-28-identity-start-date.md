# PR Template (Minimal)

## PR Goal (one sentence)
Replace IdentityCard rank display with earliest usage date (yyyy-mm-dd) and render it in yellow.

## Commit Narrative
- Commit 1: `feat(dashboard): show earliest usage date on identity card`
- Commit 2: `style(dashboard): render identity start date in yellow`

## Regression Test Gate
### Most likely regression surface
- Dashboard IdentityCard label/value rendering and copy registry.

### Verification method (choose at least one)
- [x] Existing automated tests did not fail (commands: `node --test test/dashboard-identity-start-date.test.js`, `node scripts/validate-copy-registry.cjs` => PASS; copy registry warnings unchanged: `landing.meta.*`, `usage.summary.since`, `dashboard.session.label`)
- [ ] Manual regression path executed

### Uncovered scope
- Live signed-in dashboard with persisted auth state.
