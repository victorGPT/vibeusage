## 1. Implementation

- [ ] 1.1 Add Hermes integration context and plugin install/remove helpers under `src/lib/integrations/` and related helper modules
- [ ] 1.2 Add a VibeUsage-managed Hermes plugin template (`plugin.yaml` + `__init__.py`) that writes the Hermes usage ledger via `on_session_start`, `post_api_request`, and `on_session_end`
- [ ] 1.3 Wire Hermes integration into `src/lib/integrations/index.js` and `src/commands/init.js` so `vibeusage init` installs it idempotently
- [ ] 1.4 Extend `src/commands/status.js`, `src/lib/diagnostics.js`, and `src/commands/uninstall.js` to expose Hermes plugin state and ledger state using plugin terminology
- [ ] 1.5 Add a dedicated Hermes ledger parser with cursor-based incremental ingestion and half-hour aggregation into the existing upload queue
- [ ] 1.6 Wire Hermes parsing into `src/commands/sync.js` with `source = "hermes"` and no fallback to Hermes internal stores
- [ ] 1.7 Add tests for plugin install/uninstall, privacy-safe ledger writes, incremental ledger parsing, and idempotent re-sync behavior
- [ ] 1.8 Update README and any required navigation docs to document Hermes plugin-ledger integration as the only supported Hermes path
- [ ] 1.9 Run regression commands for all touched paths and record evidence
