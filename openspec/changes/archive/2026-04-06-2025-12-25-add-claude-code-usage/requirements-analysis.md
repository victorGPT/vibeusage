# Requirements Analysis

## Goal

Enable Claude Code usage capture by installing a user-level SessionEnd hook and parsing JSONL usage records under `~/.claude/projects/` into half-hour buckets.

## Actors

- CLI user (local)
- Claude Code (writes JSONL + fires SessionEnd hook)
- VibeScore tracker CLI

## Constraints

- Hook execution must be non-blocking and always exit `0`.
- Only token usage fields are extracted; no prompt/response content.
- Existing Claude hooks must be preserved on install and uninstall.

## Out of Scope

- Real-time streaming or daemon processes.
- Project-level attribution beyond model/source.
