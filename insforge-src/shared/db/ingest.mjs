"use strict";

import "../date-core.mjs";
import {
  buildAuthHeaders,
  isUpsertUnsupported,
  normalizeRows,
  readApiJson,
  recordsUpsert,
} from "./records.mjs";

const CORE_KEY = "__vibeusageIngestDbCore";
const DEVICE_TOKEN_SELECT = "id,user_id,device_id,revoked_at,last_sync_at";

const dateCore = globalThis.__vibeusageDateCore;
if (!dateCore) throw new Error("date core not initialized");

const { isWithinInterval, normalizeIso } = dateCore;

function toNonNegativeInt(value) {
  if (typeof value !== "number") return 0;
  if (!Number.isFinite(value)) return 0;
  if (!Number.isInteger(value)) return 0;
  if (value < 0) return 0;
  return value;
}

async function fetchDeviceTokenRow({ serviceClient, baseUrl, anonKey, tokenHash, fetcher }) {
  if (serviceClient?.database?.from) {
    const { data: tokenRow, error } = await serviceClient.database
      .from("vibeusage_tracker_device_tokens")
      .select(DEVICE_TOKEN_SELECT)
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tokenRow || tokenRow.revoked_at) return null;
    return tokenRow;
  }

  if (!baseUrl || !anonKey) throw new Error("Anon key missing");

  const url = new URL("/api/database/records/vibeusage_tracker_device_tokens", baseUrl);
  url.searchParams.set("select", DEVICE_TOKEN_SELECT);
  url.searchParams.set("token_hash", `eq.${tokenHash}`);
  url.searchParams.set("limit", "1");

  const res = await (fetcher || fetch)(url.toString(), {
    method: "GET",
    headers: buildAuthHeaders({ anonKey, tokenHash }),
  });
  const { data, error } = await readApiJson(res);
  if (!res.ok) throw new Error(error || `HTTP ${res.status}`);

  const rows = normalizeRows(data);
  const tokenRow = rows?.[0] || null;
  if (!tokenRow || tokenRow.revoked_at) return null;
  return tokenRow;
}

async function updateRecord({ baseUrl, anonKey, tokenHash, table, match, values, fetcher }) {
  const url = new URL(`/api/database/records/${table}`, baseUrl);
  for (const [key, val] of Object.entries(match || {})) {
    url.searchParams.set(key, `eq.${val}`);
  }
  const res = await (fetcher || fetch)(url.toString(), {
    method: "PATCH",
    headers: {
      ...buildAuthHeaders({ anonKey, tokenHash }),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });
  const { data, error, code } = await readApiJson(res);
  return { ok: res.ok, status: res.status, data, error, code };
}

async function touchDeviceTokenAndDevice({
  serviceClient,
  baseUrl,
  anonKey,
  tokenHash,
  tokenRow,
  nowIso,
  fetcher,
  minIntervalMinutes = 30,
}) {
  if (!tokenRow) return;
  const lastSyncAt = normalizeIso(tokenRow.last_sync_at);
  const shouldUpdateSync = !lastSyncAt || !isWithinInterval(lastSyncAt, minIntervalMinutes, nowIso);
  const tokenUpdate = shouldUpdateSync
    ? { last_used_at: nowIso, last_sync_at: nowIso }
    : { last_used_at: nowIso };

  try {
    if (serviceClient?.database?.from) {
      await serviceClient.database
        .from("vibeusage_tracker_device_tokens")
        .update(tokenUpdate)
        .eq("id", tokenRow.id);
    } else if (baseUrl && anonKey) {
      await updateRecord({
        baseUrl,
        anonKey,
        tokenHash,
        table: "vibeusage_tracker_device_tokens",
        match: { id: tokenRow.id },
        values: tokenUpdate,
        fetcher,
      });
    }
  } catch (_error) {}

  try {
    if (serviceClient?.database?.from) {
      await serviceClient.database
        .from("vibeusage_tracker_devices")
        .update({ last_seen_at: nowIso })
        .eq("id", tokenRow.device_id);
    } else if (baseUrl && anonKey) {
      await updateRecord({
        baseUrl,
        anonKey,
        tokenHash,
        table: "vibeusage_tracker_devices",
        match: { id: tokenRow.device_id },
        values: { last_seen_at: nowIso },
        fetcher,
      });
    }
  } catch (_error) {}
}

async function upsertHourlyUsage({
  serviceClient,
  baseUrl,
  serviceRoleKey,
  anonKey,
  tokenHash,
  tokenRow,
  rows,
  nowIso,
  fetcher,
}) {
  if (serviceClient && serviceRoleKey && baseUrl) {
    const url = new URL("/api/database/records/vibeusage_tracker_hourly", baseUrl);
    const res = await recordsUpsert({
      url,
      anonKey: serviceRoleKey,
      tokenHash,
      rows,
      onConflict: "user_id,device_id,source,model,hour_start",
      prefer: "return=representation",
      resolution: "merge-duplicates",
      select: "hour_start",
      fetcher,
    });

    if (res.ok) {
      const insertedRows = normalizeRows(res.data);
      const inserted = Array.isArray(insertedRows) ? insertedRows.length : rows.length;
      await touchDeviceTokenAndDevice({ serviceClient, tokenRow, nowIso });
      return { ok: true, inserted, skipped: 0 };
    }

    if (!isUpsertUnsupported(res)) {
      return { ok: false, error: res.error || `HTTP ${res.status}`, inserted: 0, skipped: 0 };
    }
  }

  if (serviceClient?.database?.from) {
    const { error } = await serviceClient.database
      .from("vibeusage_tracker_hourly")
      .upsert(rows, { onConflict: "user_id,device_id,source,model,hour_start" });
    if (error) return { ok: false, error: error.message, inserted: 0, skipped: 0 };
    await touchDeviceTokenAndDevice({ serviceClient, tokenRow, nowIso });
    return { ok: true, inserted: rows.length, skipped: 0 };
  }

  if (!anonKey || !baseUrl) {
    return { ok: false, error: "Anon key missing", inserted: 0, skipped: 0 };
  }

  const url = new URL("/api/database/records/vibeusage_tracker_hourly", baseUrl);
  const res = await recordsUpsert({
    url,
    anonKey,
    tokenHash,
    rows,
    onConflict: "user_id,device_id,source,model,hour_start",
    prefer: "return=representation",
    resolution: "merge-duplicates",
    select: "hour_start",
    fetcher,
  });

  if (res.ok) {
    const insertedRows = normalizeRows(res.data);
    const inserted = Array.isArray(insertedRows) ? insertedRows.length : rows.length;
    await touchDeviceTokenAndDevice({ baseUrl, anonKey, tokenHash, tokenRow, nowIso, fetcher });
    return { ok: true, inserted, skipped: 0 };
  }

  if (isUpsertUnsupported(res)) {
    return {
      ok: false,
      error: res.error || "Half-hour upsert unsupported",
      inserted: 0,
      skipped: 0,
    };
  }

  return { ok: false, error: res.error || `HTTP ${res.status}`, inserted: 0, skipped: 0 };
}

async function upsertProjectUsage({
  serviceClient,
  baseUrl,
  serviceRoleKey,
  anonKey,
  tokenHash,
  tokenRow,
  rows,
  nowIso,
  fetcher,
}) {
  if (serviceClient && serviceRoleKey && baseUrl) {
    const url = new URL("/api/database/records/vibeusage_project_usage_hourly", baseUrl);
    const res = await recordsUpsert({
      url,
      anonKey: serviceRoleKey,
      tokenHash,
      rows,
      onConflict: "user_id,project_key,hour_start,source",
      prefer: "return=representation",
      resolution: "merge-duplicates",
      select: "hour_start",
      fetcher,
    });

    if (res.ok) {
      const insertedRows = normalizeRows(res.data);
      const inserted = Array.isArray(insertedRows) ? insertedRows.length : rows.length;
      await touchDeviceTokenAndDevice({ serviceClient, tokenRow, nowIso });
      return { ok: true, inserted, skipped: 0 };
    }

    if (!isUpsertUnsupported(res)) {
      return { ok: false, error: res.error || `HTTP ${res.status}`, inserted: 0, skipped: 0 };
    }
  }

  if (serviceClient?.database?.from) {
    const { error } = await serviceClient.database
      .from("vibeusage_project_usage_hourly")
      .upsert(rows, { onConflict: "user_id,project_key,hour_start,source" });
    if (error) return { ok: false, error: error.message, inserted: 0, skipped: 0 };
    await touchDeviceTokenAndDevice({ serviceClient, tokenRow, nowIso });
    return { ok: true, inserted: rows.length, skipped: 0 };
  }

  if (!anonKey || !baseUrl) {
    return { ok: false, error: "Anon key missing", inserted: 0, skipped: 0 };
  }

  const url = new URL("/api/database/records/vibeusage_project_usage_hourly", baseUrl);
  const res = await recordsUpsert({
    url,
    anonKey,
    tokenHash,
    rows,
    onConflict: "user_id,project_key,hour_start,source",
    prefer: "return=representation",
    resolution: "merge-duplicates",
    select: "hour_start",
    fetcher,
  });

  if (res.ok) {
    const insertedRows = normalizeRows(res.data);
    const inserted = Array.isArray(insertedRows) ? insertedRows.length : rows.length;
    await touchDeviceTokenAndDevice({ baseUrl, anonKey, tokenHash, tokenRow, nowIso, fetcher });
    return { ok: true, inserted, skipped: 0 };
  }

  if (isUpsertUnsupported(res)) {
    return {
      ok: false,
      error: res.error || "Half-hour upsert unsupported",
      inserted: 0,
      skipped: 0,
    };
  }

  return { ok: false, error: res.error || `HTTP ${res.status}`, inserted: 0, skipped: 0 };
}

async function upsertProjectRegistry({
  serviceClient,
  baseUrl,
  serviceRoleKey,
  anonKey,
  tokenHash,
  rows,
  fetcher,
}) {
  if (serviceClient && serviceRoleKey && baseUrl) {
    const url = new URL("/api/database/records/vibeusage_projects", baseUrl);
    const res = await recordsUpsert({
      url,
      anonKey: serviceRoleKey,
      tokenHash,
      rows,
      onConflict: "user_id,project_key",
      prefer: "return=representation",
      resolution: "merge-duplicates",
      select: "project_key",
      fetcher,
    });

    if (res.ok) {
      const insertedRows = normalizeRows(res.data);
      const inserted = Array.isArray(insertedRows) ? insertedRows.length : rows.length;
      return { ok: true, inserted, skipped: 0 };
    }

    if (!isUpsertUnsupported(res)) {
      return { ok: false, error: res.error || `HTTP ${res.status}`, inserted: 0, skipped: 0 };
    }
  }

  if (serviceClient?.database?.from) {
    const { error } = await serviceClient.database
      .from("vibeusage_projects")
      .upsert(rows, { onConflict: "user_id,project_key" });
    if (error) return { ok: false, error: error.message, inserted: 0, skipped: 0 };
    return { ok: true, inserted: rows.length, skipped: 0 };
  }

  if (!anonKey || !baseUrl) {
    return { ok: false, error: "Anon key missing", inserted: 0, skipped: 0 };
  }

  const url = new URL("/api/database/records/vibeusage_projects", baseUrl);
  const res = await recordsUpsert({
    url,
    anonKey,
    tokenHash,
    rows,
    onConflict: "user_id,project_key",
    prefer: "return=representation",
    resolution: "merge-duplicates",
    select: "project_key",
    fetcher,
  });

  if (res.ok) {
    const insertedRows = normalizeRows(res.data);
    const inserted = Array.isArray(insertedRows) ? insertedRows.length : rows.length;
    return { ok: true, inserted, skipped: 0 };
  }

  if (isUpsertUnsupported(res)) {
    return { ok: false, error: res.error || "Project upsert unsupported", inserted: 0, skipped: 0 };
  }

  return { ok: false, error: res.error || `HTTP ${res.status}`, inserted: 0, skipped: 0 };
}

async function upsertDeviceSubscriptions({
  serviceClient,
  baseUrl,
  serviceRoleKey,
  anonKey,
  tokenHash,
  rows,
  fetcher,
}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: true, inserted: 0, skipped: 0 };
  }

  if (serviceClient && serviceRoleKey && baseUrl) {
    const url = new URL("/api/database/records/vibeusage_tracker_subscriptions", baseUrl);
    const res = await recordsUpsert({
      url,
      anonKey: serviceRoleKey,
      tokenHash,
      rows,
      onConflict: "user_id,tool,provider,product",
      prefer: "return=representation",
      resolution: "merge-duplicates",
      select: "tool,provider,product",
      fetcher,
    });

    if (res.ok) {
      const insertedRows = normalizeRows(res.data);
      const inserted = Array.isArray(insertedRows) ? insertedRows.length : rows.length;
      return { ok: true, inserted, skipped: 0 };
    }

    if (!isUpsertUnsupported(res)) {
      return { ok: false, error: res.error || `HTTP ${res.status}`, inserted: 0, skipped: 0 };
    }
  }

  if (serviceClient?.database?.from) {
    const { error } = await serviceClient.database
      .from("vibeusage_tracker_subscriptions")
      .upsert(rows, { onConflict: "user_id,tool,provider,product" });
    if (error) return { ok: false, error: error.message, inserted: 0, skipped: 0 };
    return { ok: true, inserted: rows.length, skipped: 0 };
  }

  if (!anonKey || !baseUrl) {
    return { ok: false, error: "Anon key missing", inserted: 0, skipped: 0 };
  }

  const url = new URL("/api/database/records/vibeusage_tracker_subscriptions", baseUrl);
  const res = await recordsUpsert({
    url,
    anonKey,
    tokenHash,
    rows,
    onConflict: "user_id,tool,provider,product",
    prefer: "return=representation",
    resolution: "merge-duplicates",
    select: "tool,provider,product",
    fetcher,
  });

  if (res.ok) {
    const insertedRows = normalizeRows(res.data);
    const inserted = Array.isArray(insertedRows) ? insertedRows.length : rows.length;
    return { ok: true, inserted, skipped: 0 };
  }

  if (isUpsertUnsupported(res)) {
    return {
      ok: false,
      error: res.error || "Subscriptions upsert unsupported",
      inserted: 0,
      skipped: 0,
    };
  }

  return { ok: false, error: res.error || `HTTP ${res.status}`, inserted: 0, skipped: 0 };
}

async function recordIngestBatchMetrics({
  serviceClient,
  baseUrl,
  anonKey,
  tokenHash,
  tokenRow,
  bucketCount,
  inserted,
  skipped,
  source,
  fetcher,
}) {
  if (!tokenRow) return;
  const row = {
    user_id: tokenRow.user_id,
    device_id: tokenRow.device_id,
    device_token_id: tokenRow.id,
    source: typeof source === "string" ? source : null,
    bucket_count: toNonNegativeInt(bucketCount),
    inserted: toNonNegativeInt(inserted),
    skipped: toNonNegativeInt(skipped),
  };

  try {
    if (serviceClient?.database?.from) {
      const { error } = await serviceClient.database
        .from("vibeusage_tracker_ingest_batches")
        .insert(row);
      if (error) throw new Error(error.message);
      return;
    }
    if (!anonKey || !baseUrl) return;
    const url = new URL("/api/database/records/vibeusage_tracker_ingest_batches", baseUrl);
    const res = await (fetcher || fetch)(url.toString(), {
      method: "POST",
      headers: {
        ...buildAuthHeaders({ anonKey, tokenHash }),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const { error } = await readApiJson(res);
      throw new Error(error || `HTTP ${res.status}`);
    }
  } catch (_error) {
    // best-effort metrics; ignore failures
  }
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      fetchDeviceTokenRow,
      recordIngestBatchMetrics,
      touchDeviceTokenAndDevice,
      upsertDeviceSubscriptions,
      upsertHourlyUsage,
      upsertProjectRegistry,
      upsertProjectUsage,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}

export {
  fetchDeviceTokenRow,
  recordIngestBatchMetrics,
  touchDeviceTokenAndDevice,
  upsertDeviceSubscriptions,
  upsertHourlyUsage,
  upsertProjectRegistry,
  upsertProjectUsage,
};
