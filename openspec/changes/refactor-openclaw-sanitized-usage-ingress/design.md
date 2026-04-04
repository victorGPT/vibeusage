## Context

OpenClaw already exposes plugin hooks with enough metadata for usage accounting without requiring VibeUsage to read transcripts. In particular, the runtime can supply numeric usage via `llm_output` and non-content metadata via hook context (`agentId`, `sessionKey`, `channelId`, `trigger`, `workspaceDir`).

VibeUsage currently takes the opposite approach for OpenClaw:
- it resolves an OpenClaw session file path
- parses transcript JSONL to find `message.usage`
- applies a synthetic `prev total tokens` fallback when transcript usage is missing
- still carries a legacy integration path

That architecture conflicts with the redesign constraints for this work:
- modify only VibeUsage
- do not read user session conversation content or context
- do not touch secrets, tokens, or auth material
- use one source of truth
- no backward compatibility burden

## Goals / Non-Goals

- Goals:
  - Build a single OpenClaw accounting ingress for VibeUsage.
  - Guarantee that the OpenClaw ingress never persists or uploads conversation content.
  - Keep the existing VibeUsage half-hour bucket and upload model intact.
  - Make idempotency explicit at the OpenClaw event layer.
- Non-Goals:
  - Do not change OpenClaw core or Gateway RPC contracts.
  - Do not add OpenClaw project attribution in v1 of this rewrite.
  - Do not preserve transcript parsing or fallback math as compatibility escape hatches.
  - Do not introduce a second cloud-side schema just for OpenClaw.

## Decisions

- Decision: OpenClaw accounting is sourced from a VibeUsage-owned local sanitized ledger.
  - Why: It gives VibeUsage a single local fact source without depending on OpenClaw transcript layout or content-bearing log APIs.
  - Alternatives considered:
    - Transcript parsing: rejected because it reads the session content container.
    - Gateway `sessions.usage.logs`: rejected because current logs are transcript-derived and include `content`.
    - Plugin-pushed cumulative totals: rejected because it recreates fallback accounting and dual-truth behavior.

- Decision: The OpenClaw plugin records only whitelisted usage metadata.
  - Allowed fields: `eventId`, `emittedAt`, `source`, `agentId`, hashed `sessionRef`, `provider`, `model`, `channel`, `chatType`, `trigger`, usage token counts.
  - Disallowed fields: raw `sessionKey`, prompt/response/tool content, `assistantTexts`, `lastAssistant`, auth material, raw workspace paths.

- Decision: `llm_output` is the primary hook for OpenClaw usage accounting.
  - Why: It already supplies per-run numeric usage and provider/model metadata without requiring transcript access.
  - Note: Hook context may be used only for non-content metadata extraction and local hashing.

- Decision: OpenClaw idempotency is event-based, not transcript-offset-based.
  - `eventId` should be deterministic from stable non-content identifiers (for example run/session/time/model/usage tuple) or from a stable emitted UUID if the plugin can guarantee it is persisted once.
  - The ledger owns duplicate suppression; sync owns replay safety.

- Decision: OpenClaw v1 does not emit project attribution.
  - Why: `workspaceDir` is path-sensitive. We should not widen scope and leak path-derived identity in the same change.

## Risks / Trade-offs

- Risk: Hook payloads may include rich fields such as `assistantTexts` or `lastAssistant`.
  - Mitigation: Use a code-level whitelist builder plus tests that assert forbidden fields never enter the ledger.

- Risk: Removing transcript fallback may reveal missing OpenClaw usage events more quickly.
  - Mitigation: Prefer explicit failure/visibility over silent synthetic accounting.

- Risk: Existing docs/tests assume transcript-based OpenClaw parsing.
  - Mitigation: hard-cut the contract and update docs/tests together.

## Migration Plan

1. Freeze the new contract in OpenSpec and the implementation plan.
2. Delete legacy integration and transcript/fallback accounting code.
3. Add sanitized OpenClaw ledger writer + reader.
4. Rewire `sync --from-openclaw` to consume the sanitized ledger only.
5. Update docs and operator UX to describe the single-path model.

## Rollback

If the rewrite cannot be finished cleanly, stop before merging. Do not ship a mixed design with both sanitized ledger accounting and transcript/fallback accounting enabled.

## Open Questions

- Should `sessionRef` be HMAC-SHA256 over normalized session key with a local install salt, or another local-only keyed hash? Current recommendation: HMAC-SHA256 with a per-install salt stored under VibeUsage local state.
- Should the ledger file be JSONL or SQLite? Current recommendation for this change: JSONL append-only ledger plus explicit cursor/state, because it matches the existing VibeUsage local queueing model and keeps the rewrite tightly scoped.