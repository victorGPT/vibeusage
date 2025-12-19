# VibeScore Backend API (InsForge Edge Functions)

This document describes the public Edge Function endpoints used by the VibeScore tracker (CLI) and dashboard.

## Source of truth (important)

- Author source code lives in `insforge-src/`.
- Deployable artifacts live in `insforge-functions/` and are generated (single-file).
- Do not hand-edit `insforge-functions/*.js`; edit `insforge-src/` and rebuild.

## Build & deploy

Build deploy artifacts:

```bash
npm run build:insforge
```

Verify artifacts are up to date (no writes):

```bash
npm run build:insforge:check
```

Deploy (example):

```bash
# Update code only; keep existing slugs.
insforge2 update-function --slug vibescore-usage-summary --codeFile insforge-functions/vibescore-usage-summary.js
```

## Auth models

- **User JWT** endpoints: `Authorization: Bearer <user_jwt>`
  - Used by dashboard and user settings.
- **Device token** endpoints: `Authorization: Bearer <device_token>`
  - Used by CLI ingestion; long-lived; server stores only sha256 hash.

All endpoints support CORS `OPTIONS` preflight.

## Endpoints

### POST /functions/vibescore-device-token-issue

Issue a long-lived device token for the current user.

Auth:
- User mode: `Authorization: Bearer <user_jwt>`
- Admin bootstrap (optional): `Authorization: Bearer <service_role_key>` with `user_id` in body

Request body:

```json
{ "device_name": "my-mac", "platform": "macos" }
```

Response:

```json
{ "device_id": "uuid", "token": "opaque", "created_at": "iso" }
```

---

### POST /functions/vibescore-ingest

Ingest token usage events from a device token idempotently.

Auth:
- `Authorization: Bearer <device_token>`

Request body:

```json
{
  "events": [
    {
      "event_id": "string",
      "token_timestamp": "iso",
      "model": "string|null",
      "input_tokens": 0,
      "cached_input_tokens": 0,
      "output_tokens": 0,
      "reasoning_output_tokens": 0,
      "total_tokens": 0
    }
  ]
}
```

Response:

```json
{ "success": true, "inserted": 123, "skipped": 0 }
```

---

### GET /functions/vibescore-usage-summary

Return token usage totals for the authenticated user over a UTC date range.

Auth:
- `Authorization: Bearer <user_jwt>`

Query:
- `from=YYYY-MM-DD` (optional; default last 30 days)
- `to=YYYY-MM-DD` (optional; default today UTC)

Response (bigints as strings):

```json
{
  "from": "YYYY-MM-DD",
  "to": "YYYY-MM-DD",
  "days": 30,
  "totals": {
    "total_tokens": "0",
    "input_tokens": "0",
    "cached_input_tokens": "0",
    "output_tokens": "0",
    "reasoning_output_tokens": "0"
  }
}
```

---

### GET /functions/vibescore-usage-daily

Return UTC daily aggregates for the authenticated user.

Auth:
- `Authorization: Bearer <user_jwt>`

Query:
- `from=YYYY-MM-DD` (optional; default last 30 days)
- `to=YYYY-MM-DD` (optional; default today UTC)

Response:

```json
{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "data": [ { "day": "YYYY-MM-DD", "total_tokens": 0 } ] }
```

---

### GET /functions/vibescore-usage-heatmap

Return a GitHub-inspired activity heatmap derived from UTC daily totals.

Auth:
- `Authorization: Bearer <user_jwt>`

Query:
- `weeks=1..104` (optional; default `52`)
- `to=YYYY-MM-DD` (optional; default today UTC)
- `week_starts_on=sun|mon` (optional; default `sun`)

Response:
- `weeks` is a list of week columns; each day cell is `{ day, value, level }` or `null` past the end date.
- `value` is a bigint-as-string.

---

### GET /functions/vibescore-leaderboard

Return token usage leaderboards for the current UTC calendar window.

Auth:
- `Authorization: Bearer <user_jwt>`

Query:
- `period=day|week|month|total` (required)
- `limit=1..100` (optional; default `20`)

Rules:
- UTC calendar windows; week starts Sunday (UTC).
- Privacy-safe: no email, no user_id, no raw logs.
- Response includes `me` even when not in Top N.

Response:

```json
{
  "period": "week",
  "from": "YYYY-MM-DD",
  "to": "YYYY-MM-DD",
  "generated_at": "iso",
  "entries": [
    { "rank": 1, "is_me": false, "display_name": "Anonymous", "avatar_url": null, "total_tokens": "0" }
  ],
  "me": { "rank": null, "total_tokens": "0" }
}
```

---

### POST /functions/vibescore-leaderboard-refresh

Rebuild leaderboard snapshots for the current UTC windows (`day|week|month|total`). Intended for automation (service role only).

Auth:
- `Authorization: Bearer <service_role_key>`

Query (optional):
- `period=day|week|month|total` (when omitted, refreshes all periods)

Response:

```json
{
  "success": true,
  "generated_at": "iso",
  "results": [
    { "period": "week", "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "inserted": 42 }
  ]
}
```

---

### POST /functions/vibescore-leaderboard-settings

Update the current user's leaderboard privacy setting.

Auth:
- `Authorization: Bearer <user_jwt>`

Request body:

```json
{ "leaderboard_public": true }
```

Response:

```json
{ "leaderboard_public": true, "updated_at": "iso" }
```
