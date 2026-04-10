## Context

VibeUsage today treats each supported AI CLI as a formal integration managed by `init` / `status` / `uninstall`, while `sync` owns local parsing and cloud upload. Hermes already exposes a plugin system and lifecycle hooks. The key design question is whether Hermes support should parse Hermes internal storage, or whether Hermes should publish a dedicated minimal usage stream for VibeUsage.

The user set four hard rules for this work:

- no backward compatibility
- single source of truth
- first principles
- atomic commits

## Goals / Non-Goals

- Goals:
  - Make `vibeusage init` install and manage Hermes integration as a first-class integration.
  - Capture Hermes usage from a privacy-safe, minimal, explicit contract.
  - Keep Hermes upload behavior aligned with existing VibeUsage ingest/sync separation.
  - Preserve VibeUsage’s existing half-hour aggregate contract.
- Non-Goals:
  - Parsing `~/.hermes/state.db`, `~/.hermes/sessions/`, or trajectory files.
  - Direct network upload from Hermes hooks.
  - Backfilling historical Hermes sessions from internal stores.
  - Adding per-tool or transcript-level Hermes analytics.

## Decisions

### Decision: Hermes support is plugin-ledger only

Hermes integration SHALL be implemented as a Hermes plugin installed by `vibeusage init`, and that plugin SHALL emit a local append-only usage ledger consumed by `vibeusage sync`.

Why:
- Hermes already provides a supported plugin surface and lifecycle hooks.
- `post_api_request` already exposes normalized usage buckets, which is the closest point to the product’s first principles.
- This prevents VibeUsage from depending on Hermes internal storage schemas.

Rejected alternatives:
- Parse `~/.hermes/state.db` directly → rejected because it is not an explicit contract and carries content/privacy overreach risk.
- Parse `~/.hermes/sessions/*.json` or trajectory files → rejected because it reverses large internal artifacts into usage instead of consuming minimal facts.
- Support both ledger and internal-store fallback → rejected because it violates single-source-of-truth and complicates debugging.

### Decision: `init` is the only mutating Hermes integration entrypoint

Hermes plugin install/update/removal SHALL be managed through the existing integration lifecycle (`init`, `status`, `uninstall`). `sync`, `status`, and `diagnostics` remain read-only with respect to Hermes setup.

Why:
- Matches the existing VibeUsage integration contract.
- Keeps product behavior consistent across all supported CLIs.

### Decision: Hooks collect locally; `sync` uploads later

The Hermes plugin SHALL only append local ledger records and SHALL NOT upload to the VibeUsage backend directly.

Why:
- Hook execution is inside the agent path and must stay low-latency and failure-tolerant.
- VibeUsage already separates local ingest from cloud sync.

### Decision: Ledger is the local SSOT

Hermes local usage facts SHALL be stored in a single append-only ledger file under VibeUsage control.

Proposed path:
- `~/.vibeusage/tracker/hermes.usage.jsonl`

Why:
- Keeps all VibeUsage-owned local state under one root.
- Simplifies status, diagnostics, uninstall, purge, and cursor ownership.

## Ledger Contract

All records MUST be JSON lines with `version = 1` and `source = "hermes"`.

### `session_start`
- `type` = `session_start`
- `session_id`
- `platform`
- `model`
- `provider`
- `emitted_at`

### `usage`
- `type` = `usage`
- `session_id`
- `platform`
- `model`
- `provider`
- `api_mode`
- `api_call_count`
- `input_tokens`
- `output_tokens`
- `cache_read_tokens`
- `cache_write_tokens`
- `reasoning_tokens`
- `total_tokens`
- `finish_reason`
- `emitted_at`

### `session_end`
- `type` = `session_end`
- `session_id`
- `platform`
- `model`
- `provider`
- `emitted_at`

Explicitly forbidden in the ledger:
- prompt text
- response text
- reasoning text
- tool args/results
- raw request/response bodies
- system prompts

## Data Mapping

Hermes plugin receives normalized usage from Hermes `post_api_request`. That normalized usage is the canonical local fact.

For the current VibeUsage half-hour bucket upload contract:
- `input_tokens` → `input_tokens`
- `output_tokens` → `output_tokens`
- `reasoning_tokens` → `reasoning_output_tokens`
- `cache_read_tokens + cache_write_tokens` → `cached_input_tokens`
- `total_tokens` → `total_tokens`

Important: this projection happens only in the sync aggregation layer. The ledger keeps the finer-grained Hermes-native normalized fields.

## Implementation Shape

### VibeUsage side
- Add `src/lib/integrations/hermes.js`
- Extend `src/lib/integrations/context.js` with Hermes paths
- Add Hermes plugin install/remove helpers and plugin template assets
- Add a dedicated Hermes ledger reader (not inside `rollout.js`)
- Wire Hermes parser into `sync`, `status`, `diagnostics`, and `uninstall`

### Hermes side (installed by VibeUsage)
- Plugin directory with `plugin.yaml` and `__init__.py`
- Register exactly three hooks: `on_session_start`, `post_api_request`, `on_session_end`
- Write append-only ledger records

## Atomic Commit Plan

1. Spec/proposal/design/tasks only
2. Hermes plugin install/remove path only
3. Hermes ledger parser + sync/status/diagnostics only
4. Docs/tests/repo-sitemap updates only

## Risks / Trade-offs

- Trade-off: no historical Hermes backfill.
  - Accepted because backfill would require unsupported store parsing and violate the local SSOT rule.
- Trade-off: Hermes plugin template is initially distributed by VibeUsage, not Hermes core.
  - Accepted for MVP speed; the ledger contract remains stable even if future distribution moves upstream.

## Verification

- `vibeusage init` installs Hermes plugin idempotently.
- Hermes plugin writes ledger records without content leakage.
- Re-running `vibeusage sync` without new ledger events does not duplicate aggregates.
- `vibeusage uninstall` removes Hermes integration state and preserves/cleans local files according to `--purge`.
