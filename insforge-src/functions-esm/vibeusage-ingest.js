import { getBearerToken } from "./shared/auth.js";
import { createConcurrencyGuard } from "../shared/concurrency.mjs";
import { sha256Hex } from "./shared/crypto.js";
import { getAnonKey, getBaseUrl, getServiceRoleKey } from "./shared/env.js";
import { handleOptions, json, readJson, requireMethod } from "./shared/http.js";
import { createEdgeClient } from "./shared/insforge-client.js";
import { withRequestLogging } from "./shared/logging.js";
import {
  BILLABLE_RULE_VERSION,
  buildProjectRows,
  buildRows,
  buildSubscriptionRows,
  deriveMetricsSource,
  normalizeDeviceSubscriptionsPayload,
  normalizeHourlyPayload,
  normalizeProjectHourlyPayload,
} from "../shared/core/ingest.mjs";
import {
  fetchDeviceTokenRow,
  recordIngestBatchMetrics,
  upsertDeviceSubscriptions,
  upsertHourlyUsage,
  upsertProjectRegistry,
  upsertProjectUsage,
} from "../shared/db/ingest.mjs";

const MAX_BUCKETS = 500;
const MAX_DEVICE_SUBSCRIPTIONS = 16;

const ingestGuard = createConcurrencyGuard({
  name: "vibeusage-ingest",
  envKey: ["VIBEUSAGE_INGEST_MAX_INFLIGHT"],
  defaultMax: 0,
  retryAfterEnvKey: ["VIBEUSAGE_INGEST_RETRY_AFTER_MS"],
  defaultRetryAfterMs: 1000,
});

export default withRequestLogging("vibeusage-ingest", async function (request, logger) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, "POST");
  if (methodErr) return methodErr;

  const deviceToken = getBearerToken(request.headers.get("Authorization"));
  if (!deviceToken) return json({ error: "Missing bearer token" }, 401);

  const guard = ingestGuard?.acquire();
  if (guard && !guard.ok) {
    return json({ error: "Too many requests" }, 429, guard.headers);
  }

  const fetcher = logger?.fetch || fetch;
  const baseUrl = getBaseUrl();
  const serviceRoleKey = getServiceRoleKey();
  const anonKey = getAnonKey();
  const serviceClient = serviceRoleKey
    ? await createEdgeClient({
        baseUrl,
        anonKey: anonKey || serviceRoleKey,
        edgeFunctionToken: serviceRoleKey,
      })
    : null;

  try {
    const tokenHash = await sha256Hex(deviceToken);
    let tokenRow = null;
    try {
      tokenRow = await fetchDeviceTokenRow({ serviceClient, baseUrl, anonKey, tokenHash, fetcher });
    } catch (error) {
      return json({ error: error?.message || "Internal error" }, 500);
    }
    if (!tokenRow) return json({ error: "Unauthorized" }, 401);

    const body = await readJson(request);
    if (body.error) return json({ error: body.error }, body.status);

    const hourly = normalizeHourlyPayload(body.data);
    const projectHourly = normalizeProjectHourlyPayload(body.data);
    const deviceSubscriptions = normalizeDeviceSubscriptionsPayload(body.data);
    if (!Array.isArray(hourly) && !Array.isArray(projectHourly)) {
      return json({ error: "Invalid payload: expected {hourly:[...]} or [...]" }, 400);
    }
    if (Array.isArray(hourly) && hourly.length > MAX_BUCKETS) {
      return json({ error: `Too many buckets (max ${MAX_BUCKETS})` }, 413);
    }
    if (Array.isArray(projectHourly) && projectHourly.length > MAX_BUCKETS) {
      return json({ error: `Too many buckets (max ${MAX_BUCKETS})` }, 413);
    }
    if (
      Array.isArray(deviceSubscriptions) &&
      deviceSubscriptions.length > MAX_DEVICE_SUBSCRIPTIONS
    ) {
      return json(
        { error: `Too many device subscriptions (max ${MAX_DEVICE_SUBSCRIPTIONS})` },
        413,
      );
    }

    const nowIso = new Date().toISOString();
    const rows = Array.isArray(hourly)
      ? buildRows({ hourly, tokenRow, nowIso, billableRuleVersion: BILLABLE_RULE_VERSION })
      : { error: null, data: [] };
    if (rows.error) return json({ error: rows.error }, 400);

    const projectRows = Array.isArray(projectHourly)
      ? buildProjectRows({ hourly: projectHourly, tokenRow, nowIso })
      : { error: null, data: [] };
    if (projectRows.error) return json({ error: projectRows.error }, 400);

    const subscriptionRows = Array.isArray(deviceSubscriptions)
      ? buildSubscriptionRows({ subscriptions: deviceSubscriptions, tokenRow, nowIso })
      : { error: null, data: [] };
    if (subscriptionRows.error) return json({ error: subscriptionRows.error }, 400);

    let projectInserted = 0;
    let projectSkipped = 0;

    if (projectRows.data.length > 0) {
      const registryByKey = new Map();
      for (const row of projectRows.data) {
        registryByKey.set(row.project_key, {
          user_id: row.user_id,
          device_id: row.device_id,
          device_token_id: row.device_token_id,
          source: row.source,
          project_key: row.project_key,
          project_ref: row.project_ref,
          last_seen_at: nowIso,
          updated_at: nowIso,
        });
      }
      const registryRows = Array.from(registryByKey.values());

      const registryUpsert = await upsertProjectRegistry({
        serviceClient,
        baseUrl,
        serviceRoleKey,
        anonKey,
        tokenHash,
        rows: registryRows,
        fetcher,
      });
      if (!registryUpsert.ok) return json({ error: registryUpsert.error }, 500);

      const projectUpsert = await upsertProjectUsage({
        serviceClient,
        baseUrl,
        serviceRoleKey,
        anonKey,
        tokenHash,
        tokenRow,
        rows: projectRows.data,
        nowIso,
        fetcher,
      });
      if (!projectUpsert.ok) return json({ error: projectUpsert.error }, 500);
      projectInserted = projectUpsert.inserted;
      projectSkipped = projectUpsert.skipped;
    }

    if (subscriptionRows.data.length > 0) {
      const subscriptionUpsert = await upsertDeviceSubscriptions({
        serviceClient,
        baseUrl,
        serviceRoleKey,
        anonKey,
        tokenHash,
        rows: subscriptionRows.data,
        fetcher,
      });
      if (!subscriptionUpsert.ok) {
        logger?.log?.({
          stage: "subscription_upsert_failed",
          status: 200,
          errorCode: "SUBSCRIPTION_UPSERT_FAILED",
          details: subscriptionUpsert.error,
        });
      }
    }

    if (rows.data.length === 0) {
      await recordIngestBatchMetrics({
        serviceClient,
        baseUrl,
        anonKey,
        tokenHash,
        tokenRow,
        bucketCount: 0,
        inserted: 0,
        skipped: 0,
        source: null,
        fetcher,
      });
      return json(
        {
          success: true,
          inserted: 0,
          skipped: 0,
          project_inserted: projectInserted,
          project_skipped: projectSkipped,
        },
        200,
      );
    }

    const upsert = await upsertHourlyUsage({
      serviceClient,
      baseUrl,
      serviceRoleKey,
      anonKey,
      tokenHash,
      tokenRow,
      rows: rows.data,
      nowIso,
      fetcher,
    });
    if (!upsert.ok) return json({ error: upsert.error }, 500);

    await recordIngestBatchMetrics({
      serviceClient,
      baseUrl,
      anonKey,
      tokenHash,
      tokenRow,
      bucketCount: rows.data.length,
      inserted: upsert.inserted,
      skipped: upsert.skipped,
      source: deriveMetricsSource(rows.data),
      fetcher,
    });

    return json(
      {
        success: true,
        inserted: upsert.inserted,
        skipped: upsert.skipped,
        project_inserted: projectInserted,
        project_skipped: projectSkipped,
      },
      200,
    );
  } finally {
    if (guard && typeof guard.release === "function") guard.release();
  }
});
