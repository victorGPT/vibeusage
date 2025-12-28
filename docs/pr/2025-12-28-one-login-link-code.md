# PR Template (Minimal)

## PR Goal (one sentence)
Enable a one-login install flow by issuing a short-lived link code in Dashboard and exchanging it during CLI init.

## Commit Narrative
- Commit 1: `docs: add one-login link code design + OpenSpec change`
- Commit 2: `test: add link code edge function tests`
- Commit 3: `feat: add link code schema and exchange rpc`
- Commit 4: `feat: add link code init and exchange functions`
- Commit 5: `feat: support link code in cli init`
- Commit 6: `feat: add dashboard link code install copy`
- Commit 7: `test/docs: add manual e2e script + verification report updates`

## Rollback Semantics
- Reverting this PR restores the previous CLI login flow (browser auth) and static install command UI; link code table/RPC can remain unused safely if migrations were applied.

## Hidden Context
- Link code exchange uses service-role key and derives a deterministic device token hash from `service_role_key + code_hash + request_id` for idempotent retries.
- Link code TTL is 10 minutes and code is single-use.

## Regression Test Gate
### Most likely regression surface
- CLI `init` auth flow; device token issuance; Dashboard install card rendering/copy behavior.

### Verification method (choose at least one)
- [x] Existing automated tests did not fail (commands: `node --test test/edge-functions.test.js`, `node --test test/init-uninstall.test.js`, `node --test test/dashboard-link-code-install.test.js`, `node scripts/validate-copy-registry.cjs` => PASS; copy registry warnings unchanged)
- [ ] New minimal test added (link or describe)
- [ ] Manual regression path executed (steps + expected result)

### Uncovered scope
- Live database RPC execution and full E2E link code exchange against a deployed backend (manual script prepared but not run with real code).

## Fast-Track (only if applicable)
- Statement: I manually verified **X** behavior on **Y** path did not regress.

## Notes
- High-risk modules touched: auth flow, CLI init, backend token issuance, database writes.
