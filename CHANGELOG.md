# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.6.2] - 2026-04-25

### Fixed

- **Claude audit no longer under-counts subagent tokens.** `src/lib/ops/sources/claude.js#walkSessions` only walked `~/.claude/projects/<project>/*.jsonl`, missing every Task/Agent thread Claude Code writes under `<sessionId>/subagents/agent-*.jsonl`. Subagents consume real Anthropic tokens, so doctor's `truth` column under-counted by 0.5%–11% per day (worst: 19.9M tokens / day). Sync's `walkClaudeProjects` already recursed, so the DB had the right numbers — the audit was comparing an incomplete `truth` against a correct `db`, producing phantom drift signals (e.g. 22.6% on 04-16, 22.5% on 04-17).
- After the fix, `doctor --audit-tokens --source claude` scans 844 jsonl (was 161); `truth ≈ db` on every settled day in the 14-day window (04-13/15/18/22 sit at 0.0% drift; 04-14/16/19/20/23 ≤0.4%). Remaining drift on the current/previous day is sync lag, not a calculation bug.
- Cross-checked against Claude Code itself: SDK `usage` JSON returned by `claude -p ... --fork-session` matches the same message's `usage` field in the written jsonl byte-for-byte (input / cache_creation / cache_read / output).

### Notes

- No parser formula or DB schema changed. Other sources (codex, opencode, gemini, kimi, hermes, openclaw) verified via filesystem inspection to lack nested subagent dirs, so they are unaffected.

## [0.6.1] - 2026-04-25

### Security

- **Close SQL-interpolation face in audit helpers**. A post-merge Codex review (2026-04-24) flagged that `queryDbTotalsViaInsforge` and `resolveUserIdViaInsforge` in `src/lib/ops/audit-source.js` interpolated `userId`, `source`, and `windowStartIso` into a SQL string handed to `insforge db query` via argv. The subprocess reaches a SQL executor with service-role authority, so a maintainer-only typo such as `--user-id "foo'; DROP TABLE users; --"` could have run arbitrary SQL. Inputs are now gated by strict regexes (UUID for user/device ids, lowercase-kebab for source ids, ISO-8601 with Z for timestamps); malformed values short-circuit with `{ok: false, error: "invalid-*"}` and never reach `spawnSync`.
- No change for end-users: CLI flags and config values that were already well-formed (all production callers use UUID device ids and the hardcoded source whitelist) continue to work.

## [0.6.0] - 2026-04-24

### Added

- **Per-source token audit** across every CLI vibeusage knows about. `vibeusage doctor --audit-tokens --source <id>` walks local sessions (or ledgers), dedupes by upstream id where available, sums channels to a day total, and compares against `vibeusage_tracker_hourly`. Exit 0 within threshold, 1 over threshold, 2 on hard errors.
  - Supported ids: `claude`, `opencode`, `codex`, `every-code`, `gemini`, `kimi`, `hermes`, `openclaw`.
  - `--source all` runs every strategy and prints one status row per source so you can eyeball drift without memorising names.
  - `--days N --threshold PCT --db-json PATH --json` flags behave the same as in 0.5.0; `--db-json` stays a single-source concept.
- **Strategy framework** in `src/lib/ops/audit-source.js` + `src/lib/ops/sources/<id>.js`. New sources plug in by filling a small strategy object (`sessionRoot`, `walkSessions`, `extractUsage`, optional `iterateRecords`). The backwards-compatible `audit-claude.js` shim stays for any downstream import.
- **Token-conservation property test** (`test/parser-total-conservation.test.js`) fuzzes every `normalize*Usage` with ~200 deterministic LCG inputs and asserts `total_tokens === input + cached + output + reasoning` on compose-based normalizers (Claude / Kimi / OpenCode). The April 2026 Claude under-count would have failed this on the first fuzz input.
- **`AGENTS.md` "新 AI CLI Source 接入 Checklist" (强制)**: documents the three invariants every new source PR must satisfy (dedupe key, total_tokens covers all channels, fixture-backed regression tests).
- **Defensive ops**:
  - `scripts/ops/compare-claude-ground-truth.cjs` CLI wrapper for maintainers who want a standalone script instead of `doctor`.
  - Claude parser now returns a `dedupSkipped` metric; `sync` writes a `claude_dedup_spike` line to `notify.debug.jsonl` when the skip ratio goes above 50% — early-warning signal if Claude Code ever changes its session-log write pattern again.

### Changed

- CI workflows bumped from Node 18 to Node 20 (`deploy-preflight.yml`, `guardrails.yml`, `release.yml preflight`). `npm-publish` stays on Node 22 because Trusted Publishing requires npm ≥ 11.5.1.
- Landing copy and dashboard `CLIENTS` registry updated to include Kimi and Hermes alongside Codex / Claude Code / Gemini / OpenCode / OpenClaw.
- Integration labels brought in line with official brand names: "Claude" → "Claude Code", "Opencode Plugin" → "OpenCode Plugin".

### Notes

- No parser formula changed in this release — the 0.5.0 cache_read + dedupe fixes remain authoritative. 0.6.0 is the "observability + framework" cut: the thing that stops a similar bug from lasting months next time.
- Retrospective at `docs/retrospective/vibeusage/2026-04-24-claude-usage-parser-under-counting.md` remains the reference post-mortem for the April incident.

## [0.5.0] - 2026-04-24

### Fixed

- **Claude Code / OpenCode token under-counting (Severity S1)**. The parser was producing dashboard numbers that were roughly 5–15% of actual consumption. Two independent bugs in `src/lib/rollout.js`:
  - `normalizeClaudeUsage` (and `normalizeOpencodeTokens`) composed `total_tokens` without `cache_read_input_tokens`. On long Claude Opus sessions cache-read is ~99% of spend, which alone caused ~200× under-count.
  - `parseClaudeFile` aggregated each raw `"usage"` line it saw, but Claude Code writes the same assistant message to its session `.jsonl` multiple times (different outer `uuid`, identical `message.id` / `requestId`). A ground-truth survey found 35,163 usage rows collapsing to only 15,046 unique `message.id`s — a 2.337× multiplier (some messages duplicated up to 14×).
- Parser now dedupes on `message.id` (falling back to `requestId`) and persists the last 500 seen ids into the per-file cursor so duplicates that straddle sync invocations are still skipped. `total_tokens` includes cache-read for both Claude and OpenCode when upstream payload omits `total_tokens` (Anthropic's Messages API always does).

### Notes

- Rewinding your historical data is optional. On each machine: back up `~/.vibeusage/tracker/cursors.json`, scrub the `files` entries whose path contains `.claude/projects/` or `/opencode/storage/` and the `hourly.buckets` entries keyed by `claude|…` or `opencode|…`, then run `vibeusage sync --drain`. The ingest endpoint upserts with `resolution=merge-duplicates` against `(user_id, device_id, source, model, hour_start)`, so corrected values replace the old ones.
- Full retrospective: `docs/retrospective/vibeusage/2026-04-24-claude-usage-parser-under-counting.md`.

## [0.4.0] - 2026-04-23

### Added

- Kimi CLI integration: `vibeusage init` now writes a managed `[[hooks]]` block (SessionEnd / Stop) into `~/.kimi/config.toml`, routing events through the existing `notify.cjs` + `sync --auto` pipeline.
- Incremental Kimi session parser reads `~/.kimi/sessions/<project>/<session>/wire.jsonl`, maps `StatusUpdate.token_usage` (`input_other`, `input_cache_read`, `input_cache_creation`, `output`) into hourly buckets tagged `source=kimi`.
- Dashboard Kimi client entry: `KimiIcon` added to `CLIENTS` in `ClientLogos.jsx` so `source=kimi` rows render with a dedicated logo.

### Notes

- Backend `vibeusage_tracker_hourly.source` remains a free-form `text` column with no CHECK constraint; accepting `kimi` required no schema or edge-function changes.
- Kimi's `StatusUpdate` payload does not include a model field, so buckets are recorded with `model=unknown`.

## [0.3.0] - 2026-04-02

### Changed

- Hard-cut the CLI integration lifecycle around `src/lib/integrations/`; `init` is now the only supported command that mutates local AI CLI integration config.
- `status`, `diagnostics`, `doctor`, and `sync` are now read-only with respect to local integration setup.
- Legacy Claude Code installs that only configured `SessionEnd` are now reported as `unsupported_legacy` and require `vibeusage init`.

### Removed

- Runtime auto-heal for older installs.
- Legacy activation flow built around `activation-check` and `activate-if-needed`.

### Fixed

- Normalize equivalent Claude hook command strings during probe/remove/install checks so quoted and unquoted notify paths resolve to the same hook identity.

## [0.2.24] - 2026-04-02

### Fixed

- Install Claude Code sync hooks on both `Stop` and `SessionEnd` instead of waiting for session end only.
- Auto-heal older Claude Code installs on the next CLI run when the local notify shim is already present.

## [0.2.21] - 2026-02-18

### Changed

- Release workflow now hard-gates publish/deploy on `ci:local` success.
- Added a single local CI entrypoint: `npm run ci:local`.

### Fixed

- `init` no longer deletes its own runtime when run from the installed local app path.
- Added regression coverage for re-running `init` from the local runtime (`test/init-local-runtime-reinstall.test.js`).

## [0.2.16] - 2026-02-01

### Changed

- Project usage summary now always returns all-time totals, ignoring date filters.

### Fixed

- Dashboard auth callback storage tests now use complete Storage stubs for type safety.

## [0.2.15] - 2026-01-23

### Changed

- Bundle @insforge/sdk with the CLI package to avoid missing dependency errors at runtime.

## [0.2.14] - 2026-01-19

### Changed

- Maintenance release; no CLI behavior changes.
- Align scheduled ops workflows to vibeusage endpoints.

## [0.2.12] - 2026-01-09

### Changed

- Default CLI dashboard URL now points to https://www.vibeusage.cc.

## [0.2.11] - 2026-01-07

### Fixed

- Count Opencode cache write tokens in input totals.
- Include Claude cache creation input tokens in input totals.
- Avoid cross-message fallback totals when Opencode message index is missing.
- Surface a clear error when @insforge/sdk is missing at runtime.

## [0.2.10] - 2026-01-06

### Added

- Local Opencode usage audit CLI for comparing local usage with server totals.

### Changed

- Opencode audit defaults to ignoring missing hourly slots (use `--include-missing` to enforce).

### Fixed

- Prevent Opencode message rewrites or re-saves from double counting tokens.
- Fall back to legacy file totals when Opencode state metadata is missing.
- Defer Opencode total usage updates until timestamps are present.
- Preserve Opencode totals when message files are temporarily empty.
- Rollup backfill uses timestamptz to avoid timezone ambiguity.

## [0.2.9] - 2026-01-04

### Changed

- Opencode plugin now triggers on session.updated for auto sync.
- Opencode parser falls back to model/modelId when modelID is missing.

### Fixed

- Opencode plugin acceptance checks now align with shared plugin constants.

## [0.2.6] - 2026-01-01

### Changed

- Refresh CLI init install flow copy (local report → auth transition → success).
- Update confirmation prompt and success box messaging.

## [0.2.4] - 2025-12-30

### Fixed

- Skip Codex notify install when Codex config is missing.
- Uninstall now respects CODEX_HOME when restoring Codex notify.

## [0.2.3] - 2025-12-30

### Added

- Install Gemini CLI SessionEnd hook and enable Gemini hooks automatically for auto sync.

### Fixed

- Opencode plugin command template no longer escapes the `$` command in the generated plugin.

## [0.2.2] - 2025-12-30

### Added

- Opencode CLI usage ingestion via global plugin and local message parsing.

### Changed

- Init installs the Opencode plugin even when the config directory does not yet exist.
- Dashboard install copy now surfaces the link-code init command and removes the Opencode hint.

## [0.2.1] - 2025-12-29

### Changed

- Dashboard install panel restores the copy button and link code fetch flow.
- Init now runs a drain sync to upload all queued buckets immediately.

### Fixed

- Link code exchange uses records API to avoid RPC gateway 404s.

## [0.2.0] - 2025-12-28

### Added

- One-login link code install flow (Dashboard copy + CLI `init --link-code`).
- Link code init/exchange edge functions + RPC for short-lived codes.
- Retry-safe link code exchange in CLI via persisted request_id.

### Changed

- Dashboard shows a non-blocking session-expired banner with copy actions.
- Link code expiry auto-refreshes and re-requests on expiry.

### Fixed

- Link code exchange payload now matches RPC parameter names.
- Link code inserts allow authenticated users without service role key.

### Release

- Published to npm as `vibeusage@0.2.0`.

## [0.1.2] - 2025-12-27

### Changed

- Backfill unknown totals into the dominant known model within the same source + half-hour bucket.
- Align every-code unknown buckets to the nearest codex dominant model with deterministic tie-breakers.
- Retract prior every-code alignments and unknown buckets when newer information changes attribution.

## [0.1.1] - 2025-12-26

### Fixed

- Preserve per-model half-hour buckets (avoid collapsing multi-model hours into `unknown`).

## [0.1.0] - 2025-12-26

### Added

- Gemini CLI session parsing from `~/.gemini/tmp/**/chats/session-*.json` with UTC half-hour aggregation.
- Gemini token mapping that includes tool tokens in `output_tokens` and captures model metadata.

### Documentation

- Document Gemini CLI log location and `GEMINI_HOME`.

### Release

- Published to npm as `vibeusage@0.1.0`.

## [0.0.7] - 2025-12-24

### Added

- Auto-configure Every Code notify when `~/.code/config.toml` (or `CODE_HOME`) exists; skip if missing.

### Changed

- Notify handler supports `--source=every-code`, chains the correct original notify, and avoids self-recursion.
- Diagnostics output includes Every Code notify status and paths.

### Compatibility

- No breaking changes.
