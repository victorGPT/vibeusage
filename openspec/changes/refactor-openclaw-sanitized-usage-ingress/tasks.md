## 1. Contract freeze

- [x] 1.1 Create and approve the OpenSpec proposal, design, and delta spec for sanitized OpenClaw ingress.
- [x] 1.2 Mark the transcript-parsing, Gateway-log-accounting, and synthetic-fallback designs as rejected for OpenClaw accounting.
- [x] 1.3 Record the allowed OpenClaw event schema and forbidden-field list in docs.

## 2. Remove old OpenClaw accounting paths

- [x] 2.1 Delete `src/lib/integrations/openclaw-legacy.js` and remove its registration from `src/lib/integrations/index.js`.
- [x] 2.2 Remove OpenClaw transcript parsing from `src/lib/rollout.js`.
- [x] 2.3 Remove `applyOpenclawTotalsFallback()` and all supported `VIBEUSAGE_OPENCLAW_PREV_*` accounting inputs from `src/commands/sync.js`.
- [x] 2.4 Update `src/commands/init.js`, `src/commands/status.js`, and `src/commands/uninstall.js` to reflect a single OpenClaw integration path.

## 3. Add sanitized OpenClaw ledger

- [x] 3.1 Create a focused local ledger module for OpenClaw sanitized usage events.
- [x] 3.2 Add deterministic event id / duplicate suppression behavior.
- [x] 3.3 Add local session reference hashing with a per-install salt.
- [x] 3.4 Add tests proving the ledger schema never stores forbidden fields.

## 4. Rebuild the OpenClaw plugin contract

- [x] 4.1 Rewrite `src/lib/openclaw-session-plugin.js` so the plugin emits sanitized usage events from `llm_output` instead of transcript-derived sync hints.
- [x] 4.2 Ensure the plugin no longer passes transcript file references or previous total-token fallback fields.
- [x] 4.3 Keep plugin lifecycle installation/removal behavior intact for operators.

## 5. Rewire sync and upload

- [x] 5.1 Make `sync --from-openclaw` read only the sanitized OpenClaw ledger.
- [x] 5.2 Preserve the existing half-hour bucket upload contract for `source = "openclaw"`.
- [x] 5.3 Add idempotency tests for repeated OpenClaw trigger runs.

## 6. Documentation and verification

- [x] 6.1 Update `README.md` to describe the new OpenClaw privacy/accounting model.
- [x] 6.2 Add or update the OpenClaw integration doc with the single-path contract.
- [x] 6.3 Run regression coverage for OpenClaw init/status/uninstall/plugin/sync behavior.
- [x] 6.4 Record validation commands and outcomes in the implementation evidence.
