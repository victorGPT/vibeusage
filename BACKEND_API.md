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

## CLI troubleshooting (timeouts + debug)

When ingestion hangs or fails, use these client-side controls:

- `VIBESCORE_HTTP_TIMEOUT_MS`: HTTP request timeout in milliseconds. `0` disables timeouts. Default `20000`. Clamped to `1000..120000`.
- `VIBESCORE_DEBUG=1` or `--debug`: print request/response timing and original backend errors to stderr.

Examples:

```bash
VIBESCORE_HTTP_TIMEOUT_MS=60000 npx --yes @vibescore/tracker sync --debug
```

## Client backpressure defaults

To keep low-tier backends stable, the CLI and dashboard apply conservative defaults:

- CLI auto sync interval: ~10 minutes (with jitter)
- CLI batch size: 300 (max batches per auto run: 2 small / 4 large)
- Dashboard backend probe: every 60 seconds, paused when the tab is hidden

## Endpoints

**Timezone note:** Usage endpoints accept `tz` (IANA) or `tz_offset_minutes` (fixed offset). When provided and non-UTC, date boundaries are interpreted in that timezone. When omitted, usage endpoints default to UTC behavior.

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

Ingest half-hour token usage aggregates from a device token idempotently.

Auth:
- `Authorization: Bearer <device_token>`

Request body:

```json
{
  "hourly": [
    {
      "hour_start": "2025-12-23T06:00:00.000Z",
      "source": "codex",
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

Notes:
- `hour_start` must be a UTC half-hour boundary ISO timestamp (`:00` or `:30`).
- `source` is optional; when missing or empty, it defaults to `codex`.
- Uploads are upserts keyed by `user_id + device_id + source + hour_start`.
- Backward compatibility: `{ "data": { "hourly": [...] } }` is accepted, but `{ "hourly": [...] }` remains canonical.
- `hour_start` is the usage-time bucket. Database `created_at`/`updated_at` reflect ingest/upsert time, so many rows can share the same timestamp when a batch is uploaded.
- Internal observability: ingest requests also write a best-effort metrics row to `vibescore_tracker_ingest_batches` (project_admin only). Fields include `bucket_count`, `inserted`, `skipped`, `source`, `user_id`, `device_id`, and `created_at`. No prompt/response content is stored.
- Retention: `POST /functions/vibescore-events-retention` supports `include_ingest_batches` to purge ingest batch metrics older than the cutoff.

---

### POST /functions/vibescore-sync-ping

Record a throttled sync heartbeat for a device token. Used to distinguish “unsynced” from “no usage”.

Auth:
- `Authorization: Bearer <device_token>`

Response:

```json
{
  "success": true,
  "updated": true,
  "last_sync_at": "2025-12-22T12:30:00Z",
  "min_interval_minutes": 30
}
```

---

### GET /functions/vibescore-usage-summary

Return token usage totals for the authenticated user over a date range in the requested timezone (default UTC).

Auth:
- `Authorization: Bearer <user_jwt>`

Query:
- `from=YYYY-MM-DD` (optional; default last 30 days)
- `to=YYYY-MM-DD` (optional; default today in requested timezone)
- `source=codex|every-code|...` (optional; filter by source; omit to aggregate all sources)
- `tz=IANA` (optional; e.g. `America/Los_Angeles`)
- `tz_offset_minutes` (optional; fixed offset minutes from UTC to local, e.g. `-480`)

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
    "reasoning_output_tokens": "0",
    "total_cost_usd": "0.000000"
  },
  "pricing": {
    "model": "gpt-5.2-codex",
    "pricing_mode": "overlap",
    "source": "gpt-5.2",
    "effective_from": "2025-12-23",
    "rates_per_million_usd": {
      "input": "1.750000",
      "cached_input": "0.175000",
      "output": "14.000000",
      "reasoning_output": "14.000000"
    }
  }
}
```

---

### GET /functions/vibescore-usage-daily

Return daily aggregates for the authenticated user in the requested timezone (default UTC).

Auth:
- `Authorization: Bearer <user_jwt>`

Query:
- `from=YYYY-MM-DD` (optional; default last 30 days)
- `to=YYYY-MM-DD` (optional; default today in requested timezone)
- `source=codex|every-code|...` (optional; filter by source; omit to aggregate all sources)
- `tz=IANA` (optional; e.g. `America/Los_Angeles`)
- `tz_offset_minutes` (optional; fixed offset minutes from UTC to local, e.g. `-480`)

Response:

```json
{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "data": [ { "day": "YYYY-MM-DD", "total_tokens": 0 } ] }
```

---

### GET /functions/vibescore-usage-hourly

Return half-hour aggregates (48 buckets) for the authenticated user on a given local day (timezone-aware; default UTC).

Auth:
- `Authorization: Bearer <user_jwt>`

Query:
- `day=YYYY-MM-DD` (optional; default today in requested timezone)
- `source=codex|every-code|...` (optional; filter by source; omit to aggregate all sources)
- `tz=IANA` (optional; e.g. `America/Los_Angeles`)
- `tz_offset_minutes` (optional; fixed offset minutes from UTC to local, e.g. `-480`)

Response:

```json
{
  "day": "YYYY-MM-DD",
  "data": [
    {
      "hour": "YYYY-MM-DDTHH:00:00",
      "total_tokens": "0",
      "input_tokens": "0",
      "cached_input_tokens": "0",
      "output_tokens": "0",
      "reasoning_output_tokens": "0",
      "missing": true
    }
  ],
  "sync": {
    "last_sync_at": "2025-12-22T12:30:00Z",
    "min_interval_minutes": 30
  }
}
```

---

### GET /functions/vibescore-usage-monthly

Return monthly aggregates for the authenticated user aligned to local months (timezone-aware; default UTC).

Auth:
- `Authorization: Bearer <user_jwt>`

Query:
- `months=1..24` (optional; default `24`)
- `to=YYYY-MM-DD` (optional; default today in requested timezone)
- `source=codex|every-code|...` (optional; filter by source; omit to aggregate all sources)
- `tz=IANA` (optional; e.g. `America/Los_Angeles`)
- `tz_offset_minutes` (optional; fixed offset minutes from UTC to local, e.g. `-480`)

Response:

```json
{
  "from": "YYYY-MM-DD",
  "to": "YYYY-MM-DD",
  "months": 24,
  "data": [
    {
      "month": "YYYY-MM",
      "total_tokens": "0",
      "input_tokens": "0",
      "cached_input_tokens": "0",
      "output_tokens": "0",
      "reasoning_output_tokens": "0"
    }
  ]
}
```

---

### GET /functions/vibescore-usage-heatmap

Return a GitHub-inspired activity heatmap derived from local daily totals (timezone-aware; default UTC).

Auth:
- `Authorization: Bearer <user_jwt>`

Query:
- `weeks=1..104` (optional; default `52`)
- `to=YYYY-MM-DD` (optional; default today in requested timezone)
- `week_starts_on=sun|mon` (optional; default `sun`)
- `source=codex|every-code|...` (optional; filter by source; omit to aggregate all sources)
- `tz=IANA` (optional; e.g. `America/Los_Angeles`)
- `tz_offset_minutes` (optional; fixed offset minutes from UTC to local, e.g. `-480`)

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
- `Authorization: Bearer <service_role_key|api_key>`

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

Manual refresh runbook:

```bash
BASE_URL="https://5tmappuk.us-east.insforge.app"
ADMIN_TOKEN="<service_role_key or api_key>"

for period in day week month total; do
  echo "period=$period"
  curl -s -X POST "$BASE_URL/functions/vibescore-leaderboard-refresh?period=${period}" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{}"
done
```

Verification:

```bash
curl -s "$BASE_URL/functions/vibescore-leaderboard?period=week" \
  -H "Authorization: Bearer <user_jwt>"
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

---

### POST /functions/vibescore-events-retention

Purge legacy tracker events older than a cutoff (admin only).

Auth:
- `Authorization: Bearer <service_role_key>`

Request body:

```json
{ "days": 30, "dry_run": false }
```

Response:

```json
{ "ok": true, "dry_run": false, "days": 30, "cutoff": "iso", "deleted": 123 }
```

---

### GET /functions/vibescore-debug-auth

Diagnostic endpoint that reports whether the function runtime has the anon key
configured and whether the supplied bearer token validates. This does **not**
expose any secrets.

Auth:
- Optional `Authorization: Bearer <user_jwt>` to validate the token.

Response:

```json
{
  "hasAnonKey": true,
  "hasBearer": true,
  "authOk": true,
  "userId": "uuid",
  "error": null
}
```
