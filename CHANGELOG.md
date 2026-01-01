# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
- Published to npm as `@vibescore/tracker@0.2.0`.

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
- Published to npm as `@vibescore/tracker@0.1.0`.

## [0.0.7] - 2025-12-24
### Added
- Auto-configure Every Code notify when `~/.code/config.toml` (or `CODE_HOME`) exists; skip if missing.

### Changed
- Notify handler supports `--source=every-code`, chains the correct original notify, and avoids self-recursion.
- Diagnostics output includes Every Code notify status and paths.

### Compatibility
- No breaking changes.
