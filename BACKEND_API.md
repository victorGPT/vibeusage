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

## Endpoint base paths

- Public edge functions are served at `/functions/<slug>` (CORS enabled).
- Admin API path `/api/functions/<slug>` requires a project admin API key and is **not** suitable for browser clients.
- Dashboard uses `/functions` and only falls back to `/api/functions` on 404 in privileged contexts.

## CLI troubleshooting (timeouts + debug)

When ingestion hangs or fails, use these client-side controls:

- `VIBESCORE_HTTP_TIMEOUT_MS`: HTTP request timeout in milliseconds. `0` disables timeouts. Default `20000`. Clamped to `1000..120000`.
- `VIBESCORE_DEBUG=1` or `--debug`: print request/response timing and original backend errors to stderr.

Examples:

```bash
VIBESCORE_HTTP_TIMEOUT_MS=60000 npx --yes @vibescore/tracker sync --debug
```

## Pricing configuration

Pricing metadata is resolved from `vibescore_pricing_profiles`. The default pricing profile is selected by:

- `VIBESCORE_PRICING_SOURCE` (default `openrouter`)
- `VIBESCORE_PRICING_MODEL` (default `gpt-5.2-codex`; exact match or `*/<model>` suffix match)

OpenRouter sync requires these environment variables in InsForge:

- `OPENROUTER_API_KEY` (required)
- `OPENROUTER_HTTP_REFERER` (optional, for attribution)
- `OPENROUTER_APP_TITLE` (optional, for attribution)

Health check:
- See `docs/ops/pricing-sync-health.md` and `scripts/ops/pricing-sync-health.sql`.

Alias mapping:
- `vibescore_pricing_model_aliases` maps `usage_model` -> `pricing_model` with `effective_from`.
- Resolver checks alias mapping before suffix matching.

## Usage guardrails & observability

To reduce runaway scans and runtime resets, usage read endpoints enforce bounded ranges and emit slow-query logs.

- `VIBESCORE_USAGE_MAX_DAYS`: max day span for `GET /functions/vibescore-usage-summary`, `.../vibescore-usage-daily`, and `.../vibescore-usage-model-breakdown`. Default `800`. Oversized ranges return `400` with `Date range too large (max N days)`.
- `VIBESCORE_SLOW_QUERY_MS`: slow-query log threshold in milliseconds. Default `2000`. When exceeded, a `stage: slow_query` log is emitted with `query_label`, `duration_ms`, and `row_count`.

## Client backpressure defaults

To keep low-tier backends stable, the CLI and dashboard apply conservative defaults:

- CLI auto sync interval: ~10 minutes (with jitter)
- CLI batch size: 300 (max batches per auto run: 2 small / 4 large)
- Dashboard backend probe: every 60 seconds, paused when the tab is hidden

## Endpoints

**Timezone note:** Usage endpoints accept `tz` (IANA) or `tz_offset_minutes` (fixed offset). When provided and non-UTC, date boundaries are interpreted in that timezone. When omitted, usage endpoints default to UTC behavior.

**Canary note:** Usage endpoints exclude `source=model=canary` buckets by default unless explicitly requested via `source=canary` or `model=canary`.

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

### POST /functions/vibescore-link-code-init

Issue a short-lived, single-use link code bound to the current user session.

Auth:
- `Authorization: Bearer <user_jwt>`

Request body:

```json
{}
```

Response:

```json
{ "link_code": "string", "expires_at": "iso" }
```

Notes:
- Link codes expire after ~10 minutes.
- Each link code can be used once.

---

### POST /functions/vibescore-link-code-exchange

Exchange a link code for a device token (CLI init flow).

Auth:
- None (public function; server uses service role internally)

Request body:

```json
{
  "link_code": "string",
  "request_id": "string",
  "device_name": "string?",
  "platform": "string?"
}
```

Response:

```json
{ "token": "opaque", "device_id": "uuid", "user_id": "uuid" }
```

Notes:
- `request_id` is required for replay safety; retries with the same `request_id` return the same token.
- Expired link codes return `400` and used codes return `409`.

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
      "model": "unknown",
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
- `model` is optional; when missing or empty, it defaults to `unknown`.
- Uploads are upserts keyed by `user_id + device_id + source + model + hour_start`.
- Backward compatibility: `{ "data": { "hourly": [...] } }` is accepted, but `{ "hourly": [...] }` remains canonical.
- `hour_start` is the usage-time bucket. Database `created_at`/`updated_at` reflect ingest/upsert time, so many rows can share the same timestamp when a batch is uploaded.
- Internal observability: ingest requests also write a best-effort metrics row to `vibescore_tracker_ingest_batches` (project_admin only). Fields include `bucket_count`, `inserted`, `skipped`, `source`, `user_id`, `device_id`, and `created_at`. No prompt/response content is stored.
- Retention: `POST /functions/vibescore-events-retention` supports `include_ingest_batches` to purge ingest batch metrics older than the cutoff.
- When concurrency limits are exceeded, the endpoint may return `429` with `Retry-After` to signal backoff. The guard is opt-in via `VIBESCORE_INGEST_MAX_INFLIGHT`.

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

### GET /functions/vibescore-user-status

Return Pro status for the authenticated user.

Auth:
- `Authorization: Bearer <user_jwt>`

Response:

```json
{
  "user_id": "uuid",
  "created_at": "iso|null",
  "pro": {
    "active": true,
    "sources": ["registration_cutoff", "entitlement"],
    "expires_at": "iso",
    "partial": false,
    "as_of": "iso"
  }
}
```

Notes:
- Registration cutoff is fixed at `2025-12-31T23:59:59` Asia/Shanghai (`2025-12-31T15:59:59Z`).
- Registration-based Pro expires at `created_at + 99 years`.
- Entitlements are active when `now_utc` is in `[effective_from, effective_to)` and `revoked_at IS NULL`.
- When `created_at` is unavailable and no service-role key is configured, the endpoint returns a partial result (`created_at: null`, `pro.partial: true`) computed from entitlements only.

---

### POST /functions/vibescore-entitlements

Grant an entitlement for a user (admin only).

Auth:
- `Authorization: Bearer <service_role_key>` or a `project_admin` JWT

Request body:

```json
{
  "id": "uuid?",
  "idempotency_key": "string?",
  "user_id": "uuid",
  "source": "paid|override|manual",
  "effective_from": "iso",
  "effective_to": "iso",
  "note": "string?"
}
```

Response:

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "source": "manual",
  "effective_from": "iso",
  "effective_to": "iso",
  "revoked_at": null,
  "note": "string?",
  "created_at": "iso",
  "updated_at": "iso"
}
```

Notes:
- For idempotent retries, send a stable `id` or `idempotency_key` (the backend derives a deterministic id).
- If the `id` or `idempotency_key` already exists with a different payload, the endpoint returns `409`.

---

### POST /functions/vibescore-entitlements-revoke

Revoke an entitlement by id (admin only).

Auth:
- `Authorization: Bearer <service_role_key>` or a `project_admin` JWT

Request body:

```json
{ "id": "uuid", "revoked_at": "iso?" }
```

Response:

```json
{ "id": "uuid", "revoked_at": "iso" }
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
- `model=<model-id>` (optional; filter by model; omit to aggregate all models)
- `tz=IANA` (optional; e.g. `America/Los_Angeles`)
- `tz_offset_minutes` (optional; fixed offset minutes from UTC to local, e.g. `-480`)
- `debug=1` (optional; include debug payload for query timing)

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
    "source": "openrouter",
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

Notes:
- Pricing metadata is resolved from `vibescore_pricing_profiles` using the configured default model/source and the latest `effective_from` not in the future (`active=true`).
- If no pricing rows exist, the endpoint falls back to the built-in default profile.
- `pricing_mode` is `add`, `overlap`, or `mixed` (multiple pricing modes across sources).
- When `debug=1` is set, the response includes a `debug` object with `request_id`, `status`, `query_ms`, `slow_threshold_ms`, `slow_query`.

---

### GET /functions/vibescore-usage-model-breakdown

Return per-source and per-model aggregates for a date range. This endpoint is intended for model mix and cost breakdown UI.

Auth:
- `Authorization: Bearer <user_jwt>`

Query:
- `from=YYYY-MM-DD` (optional; default last 30 days)
- `to=YYYY-MM-DD` (optional; default today in requested timezone)
- `source=codex|every-code|...` (optional; filter by source; omit to aggregate all sources)
- `tz=IANA` (optional; e.g. `America/Los_Angeles`)
- `tz_offset_minutes` (optional; fixed offset minutes from UTC to local, e.g. `-480`)
- `debug=1` (optional; include debug payload for query timing)

Notes:
- `model` is not accepted because this endpoint already returns per-model groups.
- Pricing metadata is resolved from `vibescore_pricing_profiles`. If the range contains exactly one non-`unknown` model, pricing is resolved for that model; otherwise it falls back to the configured default profile.
- `pricing_mode` is `add`, `overlap`, or `mixed` (multiple pricing modes across sources).
- When `debug=1` is set, the response includes a `debug` object with `request_id`, `status`, `query_ms`, `slow_threshold_ms`, `slow_query`.

Response (bigints as strings):

```json
{
  "from": "YYYY-MM-DD",
  "to": "YYYY-MM-DD",
  "days": 30,
  "sources": [
    {
      "source": "codex",
      "totals": {
        "total_tokens": "0",
        "input_tokens": "0",
        "cached_input_tokens": "0",
        "output_tokens": "0",
        "reasoning_output_tokens": "0",
        "total_cost_usd": "0.000000"
      },
      "models": [
        {
          "model": "gpt-5.2-codex",
          "totals": {
            "total_tokens": "0",
            "input_tokens": "0",
            "cached_input_tokens": "0",
            "output_tokens": "0",
            "reasoning_output_tokens": "0",
            "total_cost_usd": "0.000000"
          }
        }
      ]
    }
  ],
  "pricing": {
    "model": "gpt-5.2-codex",
    "pricing_mode": "overlap",
    "source": "openrouter",
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
- `model=<model-id>` (optional; filter by model; omit to aggregate all models)
- `tz=IANA` (optional; e.g. `America/Los_Angeles`)
- `tz_offset_minutes` (optional; fixed offset minutes from UTC to local, e.g. `-480`)

Response:

```json
{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "data": [ { "day": "YYYY-MM-DD", "total_tokens": 0 } ] }
```

Notes:
- When `debug=1` is set, the response includes a `debug` object with `request_id`, `status`, `query_ms`, `slow_threshold_ms`, `slow_query`.

---

### GET /functions/vibescore-usage-hourly

Return half-hour aggregates (48 buckets) for the authenticated user on a given local day (timezone-aware; default UTC).

Auth:
- `Authorization: Bearer <user_jwt>`

Query:
- `day=YYYY-MM-DD` (optional; default today in requested timezone)
- `source=codex|every-code|...` (optional; filter by source; omit to aggregate all sources)
- `model=<model-id>` (optional; filter by model; omit to aggregate all models)
- `tz=IANA` (optional; e.g. `America/Los_Angeles`)
- `tz_offset_minutes` (optional; fixed offset minutes from UTC to local, e.g. `-480`)
- `debug=1` (optional; include debug payload for query timing)

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

Notes:
- When `debug=1` is set, the response includes a `debug` object with `request_id`, `status`, `query_ms`, `slow_threshold_ms`, `slow_query`.

---

### GET /functions/vibescore-usage-monthly

Return monthly aggregates for the authenticated user aligned to local months (timezone-aware; default UTC).

Auth:
- `Authorization: Bearer <user_jwt>`

Query:
- `months=1..24` (optional; default `24`)
- `to=YYYY-MM-DD` (optional; default today in requested timezone)
- `source=codex|every-code|...` (optional; filter by source; omit to aggregate all sources)
- `model=<model-id>` (optional; filter by model; omit to aggregate all models)
- `tz=IANA` (optional; e.g. `America/Los_Angeles`)
- `tz_offset_minutes` (optional; fixed offset minutes from UTC to local, e.g. `-480`)
- `debug=1` (optional; include debug payload for query timing)

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

Notes:
- When `debug=1` is set, the response includes a `debug` object with `request_id`, `status`, `query_ms`, `slow_threshold_ms`, `slow_query`.

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
- `model=<model-id>` (optional; filter by model; omit to aggregate all models)
- `tz=IANA` (optional; e.g. `America/Los_Angeles`)
- `tz_offset_minutes` (optional; fixed offset minutes from UTC to local, e.g. `-480`)
- `debug=1` (optional; include debug payload for query timing)

Response:

```json
{
  "from": "YYYY-MM-DD",
  "to": "YYYY-MM-DD",
  "week_starts_on": "sun",
  "thresholds": { "t1": "0", "t2": "0", "t3": "0" },
  "active_days": 0,
  "streak_days": 0,
  "weeks": [
    [
      { "day": "YYYY-MM-DD", "value": "0", "level": 0 },
      null
    ]
  ]
}
```

Notes:
- `weeks` is a list of week columns; each day cell is `{ day, value, level }` or `null` past the end date.
- `value` is a bigint-as-string.
- When `debug=1` is set, the response includes a `debug` object with `request_id`, `status`, `query_ms`, `slow_threshold_ms`, `slow_query`.

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

### POST /functions/vibescore-pricing-sync

Sync OpenRouter Models API pricing into `vibescore_pricing_profiles` (admin only).

Auth:
- `Authorization: Bearer <service_role_key>`

Request body:

```json
{ "retention_days": 90, "effective_from": "2025-12-25", "allow_models": ["gpt-5.2-codex"] }
```

Notes:
- `retention_days` is optional; when provided, rows older than the cutoff are soft-deactivated (`active=false`).
- `effective_from` defaults to today (UTC).
- `allow_models` is optional; when omitted, all models from OpenRouter are processed.
- Alias generation: unmatched usage models are mapped via vendor rules (`claude-*` -> `anthropic/*`, `gpt-*` -> `openai/*`) and frozen by `effective_from`.

Response:

```json
{
  "success": true,
  "source": "openrouter",
  "effective_from": "2025-12-25",
  "models_total": 300,
  "models_processed": 280,
  "models_skipped": 20,
  "rows_upserted": 280,
  "usage_models_total": 42,
  "aliases_generated": 5,
  "aliases_upserted": 5,
  "retention": { "retention_days": 90, "cutoff_date": "2025-09-26" }
}
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
