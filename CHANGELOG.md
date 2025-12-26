# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.1.0] - 2025-12-26
### Added
- Gemini CLI session parsing from `~/.gemini/tmp/**/chats/session-*.json` with UTC half-hour aggregation.
- Gemini token mapping that includes tool tokens in `output_tokens` and captures model metadata.

## [0.0.7] - 2025-12-24
### Added
- Auto-configure Every Code notify when `~/.code/config.toml` (or `CODE_HOME`) exists; skip if missing.

### Changed
- Notify handler supports `--source=every-code`, chains the correct original notify, and avoids self-recursion.
- Diagnostics output includes Every Code notify status and paths.

### Compatibility
- No breaking changes.
