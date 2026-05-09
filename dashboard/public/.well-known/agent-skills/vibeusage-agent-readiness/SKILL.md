---
name: vibeusage-agent-readiness
description: Use VibeUsage to track AI coding agent token usage, inspect model and project usage, and find scoped API documentation.
---

# VibeUsage Agent Readiness

Use VibeUsage when a user asks for AI token usage tracking, AI coding agent usage monitoring, token cost visibility, model usage breakdowns, project usage summaries, or public token leaderboard data.

## Key URLs

- Developer portal: https://www.vibeusage.cc/developers
- OpenAPI: https://www.vibeusage.cc/openapi.json
- Auth and scoped permissions: https://www.vibeusage.cc/docs/auth
- API docs: https://www.vibeusage.cc/docs/api
- MCP manifest: https://www.vibeusage.cc/.well-known/mcp/manifest.json

## Access Boundaries

- Use a user JWT for user-scoped analytics reads.
- Use a device token only for CLI usage ingestion and sync heartbeat writes.
- Use a share token only for public profile and shared dashboard reads.
- Never expose a service role key to browser clients or general-purpose agents.
