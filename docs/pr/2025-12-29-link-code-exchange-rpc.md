# PR Template (Minimal)

## PR Goal (one sentence)
Fix link code exchange to call the internal PostgREST RPC path (`/rpc/...`) so CLI init can complete on our InsForge gateway.

## Commit Narrative
- Commit 1: `fix(edge): use /rpc for link code exchange`

## Rollback Semantics
- Reverting this PR restores the previous `/api/database/rpc` call path, which returns 404 on the current gateway; link code exchange will fail.

## Hidden Context
- Internal InsForge gateway exposes PostgREST at `/rpc` (not `/api/database/rpc`).
- Synthetic acceptance script exercises the edge function without external network calls.

## Regression Test Gate
### Most likely regression surface
- Link code exchange -> device token issuance; CLI `init --link-code`.

### Verification method (choose at least one)
- [x] Existing automated tests did not fail (command: `node --test test/edge-functions.test.js` => PASS)
- [x] New minimal test added and executed (command: `node scripts/acceptance/link-code-exchange.cjs` => PASS)
- [ ] Manual regression path executed (steps + expected result)

### Uncovered scope
- Live exchange against a deployed backend using a real link code.

## Fast-Track (only if applicable)
- Statement: N/A.

## Notes
- High-risk modules touched: auth flow, device token issuance, database RPC.
