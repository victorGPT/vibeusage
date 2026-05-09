# VibeUsage Webhook Status

VibeUsage does not currently expose outbound webhooks.

Agents and integrations should use scoped read endpoints, sync heartbeat state, and the OpenAPI resources until a webhook API appears in the public contract.

- Current usage state: call user-scoped usage analytics endpoints with `usage:read`.
- Sync freshness: use hourly usage sync fields and `POST /functions/vibeusage-sync-ping`.
- Capability source of truth: https://www.vibeusage.cc/openapi.json
