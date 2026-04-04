# OpenClaw integration

## Supported architecture

VibeUsage supports exactly one OpenClaw accounting path:

**OpenClaw session plugin → local sanitized usage ledger → `sync --from-openclaw`**

This is the only supported local accounting source for `source = "openclaw"`.

## Privacy / accounting contract

The OpenClaw plugin writes only sanitized usage metadata into the local ledger.

Allowed fields:
- `eventId`
- `emittedAt`
- `source`
- `agentId`
- hashed `sessionRef`
- `provider`
- `model`
- `channel`
- `chatType`
- `trigger`
- usage token counts

Forbidden fields:
- raw `sessionKey`
- prompt / response / tool content
- `assistantTexts`
- `lastAssistant`
- raw `workspaceDir`
- secrets, tokens, passwords, private keys

## Rejected paths

The OpenClaw integration does **not** use any of the following for accounting:
- session transcript parsing
- `sessions.usage.logs`
- synthetic fallback totals
- the removed legacy OpenClaw hook path

## Local files

Typical local artifacts:
- `~/.vibeusage/tracker/openclaw-usage-ledger.jsonl`
- `~/.vibeusage/tracker/openclaw-usage-ledger.state.json`
- `~/.vibeusage/tracker/openclaw-usage-ledger.salt`
- `~/.vibeusage/tracker/openclaw-plugin/openclaw-session-sync/`

## Operator flow

1. Run `npx vibeusage init`
2. Restart OpenClaw gateway so the linked plugin is activated
3. Run a real OpenClaw turn
4. Run `npx vibeusage sync --from-openclaw`

## Validation status

Validated locally on 2026-04-05:
- the OpenClaw session plugin was linked/enabled/loaded
- a real OpenClaw turn wrote `openclaw-usage-ledger.jsonl`
- ledger rows contained only sanitized fields
- `npx vibeusage sync --from-openclaw` consumed the ledger and uploaded OpenClaw buckets
- a second `sync --from-openclaw` run was idempotent

## Out of scope in v1

- OpenClaw project attribution
