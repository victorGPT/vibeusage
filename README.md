# @vibescore/tracker

Codex CLI token usage tracker (macOS-first, notify-driven).

## Quick Start

```bash
npx --yes @vibescore/tracker init
npx --yes @vibescore/tracker sync
npx --yes @vibescore/tracker status
npx --yes @vibescore/tracker uninstall
```

## Requirements

- Node.js >= 18
- macOS (current supported platform)

## Notes

- `init` installs a Codex CLI notify hook, issues a device token, and runs an initial sync.
- `sync` parses `~/.codex/sessions/**/rollout-*.jsonl` and uploads token_count deltas (auto sync is throttled to a 30-minute cadence).

## License

MIT
