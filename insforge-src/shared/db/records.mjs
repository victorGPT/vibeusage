"use strict";

const CORE_KEY = "__vibeusageDbRecordsCore";

function buildAuthHeaders({ anonKey, tokenHash }) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "x-vibeusage-device-token-hash": tokenHash,
  };
}

async function readApiJson(res) {
  const text = await res.text();
  if (!text) return { data: null, error: null, code: null };
  try {
    const parsed = JSON.parse(text);
    return {
      data: parsed,
      error: parsed?.message || parsed?.error || null,
      code: parsed?.code || null,
    };
  } catch (_error) {
    return { data: null, error: text.slice(0, 300), code: null };
  }
}

function normalizeRows(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.data)) return data.data;
  return null;
}

function isUpsertUnsupported(result) {
  const status = Number(result?.status || 0);
  if (status !== 400 && status !== 404 && status !== 405 && status !== 409 && status !== 422) {
    return false;
  }
  const msg = String(result?.error || "").toLowerCase();
  if (!msg) return false;
  return (
    msg.includes("on_conflict") ||
    msg.includes("resolution") ||
    msg.includes("prefer") ||
    msg.includes("unknown") ||
    msg.includes("invalid")
  );
}

async function recordsUpsert({
  url,
  anonKey,
  tokenHash,
  rows,
  onConflict,
  prefer,
  resolution,
  select,
  fetcher,
}) {
  const target = new URL(url.toString());
  if (onConflict) target.searchParams.set("on_conflict", onConflict);
  if (select) target.searchParams.set("select", select);
  const preferParts = [];
  if (prefer) preferParts.push(prefer);
  if (resolution) preferParts.push(`resolution=${resolution}`);
  const preferHeader = preferParts.filter(Boolean).join(",");

  const res = await (fetcher || fetch)(target.toString(), {
    method: "POST",
    headers: {
      ...buildAuthHeaders({ anonKey, tokenHash }),
      ...(preferHeader ? { Prefer: preferHeader } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(rows),
  });

  const { data, error, code } = await readApiJson(res);
  return { ok: res.ok, status: res.status, data, error, code };
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      buildAuthHeaders,
      isUpsertUnsupported,
      normalizeRows,
      readApiJson,
      recordsUpsert,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}

export { buildAuthHeaders, isUpsertUnsupported, normalizeRows, readApiJson, recordsUpsert };
