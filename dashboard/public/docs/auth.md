# VibeUsage Auth and Scoped Permissions

VibeUsage separates access by credential role so agents can request the least powerful token needed for the task.

- User JWT: reads the signed-in user's analytics, issues device tokens, manages public visibility, and reads optional self-aware leaderboard context.
- Device token: limited to usage ingestion and sync heartbeat writes.
- Share token: limited to privacy-safe public profile and shared dashboard reads.
- Service role key: admin credential for maintenance jobs. Do not expose to browser clients or general-purpose agents.

OpenAPI documents operation-level `x-required-permissions`: https://www.vibeusage.cc/openapi.json
