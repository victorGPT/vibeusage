## 1. Backend schema + RPC
- [ ] 1.1 Create link code table with TTL + single-use fields
- [ ] 1.2 Add atomic exchange RPC or function

## 2. Edge functions
- [ ] 2.1 Implement link code init endpoint (session-bound)
- [ ] 2.2 Implement link code exchange endpoint (idempotent)

## 3. CLI init
- [ ] 3.1 Add `--link-code` flag handling
- [ ] 3.2 Exchange link code for device token during init

## 4. Dashboard UI + copy registry
- [ ] 4.1 Add copy strings to `dashboard/src/content/copy.csv`
- [ ] 4.2 Render install command with link code
- [ ] 4.3 Add "copy full command" button
- [ ] 4.4 Mask user id display while preserving full copy value

## 5. Tests
- [ ] 5.1 Backend tests: exchange idempotency + expiry
- [ ] 5.2 Frontend tests: copy command + masking
- [ ] 5.3 CLI regression: init still works without link code

## 6. Docs + verification
- [ ] 6.1 Update design/plan artifacts as needed
- [ ] 6.2 Record regression verification steps + results
