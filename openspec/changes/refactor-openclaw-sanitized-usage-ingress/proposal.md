# Change: Refactor OpenClaw usage ingress to sanitized ledger SSOT

## Why

The current OpenClaw ingestion path in VibeUsage still parses OpenClaw session transcripts and carries a synthetic fallback path based on previous total tokens. That violates the intended privacy boundary for this integration, couples VibeUsage to OpenClaw storage internals, and leaves OpenClaw with more than one accounting path.

The alternative "pull from OpenClaw Gateway usage logs" direction is also not acceptable for this change. The current OpenClaw `sessions.usage.logs` surface is transcript-derived and returns content-bearing log entries, which crosses the red line for this redesign.

We need one OpenClaw path, one local fact source, no backward compatibility burden, and a schema that never stores or uploads session content or secrets.

## What Changes

- Replace the OpenClaw transcript/fallback ingestion path with a VibeUsage-owned OpenClaw plugin path that emits sanitized usage events only.
- Introduce a local append-only OpenClaw usage ledger as the only VibeUsage accounting source for `source = "openclaw"`.
- Remove OpenClaw transcript parsing, synthetic fallback totals, and the `openclaw-legacy` integration.
- Keep the existing half-hour bucket upload contract and backend/dashboard source model unchanged; this is a VibeUsage-only rewrite.
- Hard-cut the integration contract: no transcript repair, no Gateway log accounting, no legacy compatibility layer.

## Impact

- Affected specs: `vibeusage-tracker`
- Affected code:
  - `src/commands/sync.js`
  - `src/lib/rollout.js`
  - `src/lib/openclaw-session-plugin.js`
  - `src/lib/integrations/index.js`
  - `src/lib/integrations/openclaw-session.js`
  - `src/lib/integrations/openclaw-legacy.js`
  - `src/commands/init.js`
  - `src/commands/status.js`
  - `src/commands/uninstall.js`
  - `README.md`
  - `test/openclaw-session-plugin.test.js`
  - `test/sync-openclaw-trigger.test.js`
  - new OpenClaw ledger/integration tests

## Breaking Notes

- **BREAKING**: OpenClaw usage accounting will no longer read `~/.openclaw/agents/*/sessions/*.jsonl`.
- **BREAKING**: `VIBEUSAGE_OPENCLAW_PREV_*` synthetic fallback inputs are removed from the supported accounting contract.
- **BREAKING**: `openclaw-legacy` is removed instead of being preserved as a compatibility path.

## Approval Gate

This proposal is for planning only. Implementation MUST NOT start until this change is explicitly approved.