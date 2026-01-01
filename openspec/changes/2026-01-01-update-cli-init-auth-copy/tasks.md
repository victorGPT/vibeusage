## 1. Implementation
- [x] 1.1 Add `src/lib/init-flow.js` to centralize the init copy deck and staged renderer.
- [x] 1.2 Refactor `src/commands/init.js` to emit Local → Report → Auth → Success in order.
- [x] 1.3 Update success output to include the resolved Dashboard URL.

## 2. Tests
- [x] 2.1 Add CLI output regression test for the new stage order.
- [x] 2.2 Add CLI output test that includes the resolved Dashboard URL in success.

## 3. Verification
- [x] 3.1 Run `node --test test/init-flow-copy.test.js`.
- [x] 3.2 Run `node --test test/init-dry-run.test.js test/init-spawn-error.test.js`.

## 4. Docs
- [x] 4.1 No docs changes required (CLI-only copy).
