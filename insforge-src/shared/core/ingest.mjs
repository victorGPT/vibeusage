"use strict";

import "../date-core.mjs";
import "../runtime-primitives-core.mjs";
import "../usage-model-core.mjs";
import "../usage-metrics-core.mjs";

const CORE_KEY = "__vibeusageIngestCore";
const DEFAULT_MODEL = "unknown";
const BILLABLE_RULE_VERSION = 1;

const dateCore = globalThis.__vibeusageDateCore;
if (!dateCore) throw new Error("date core not initialized");
const runtimePrimitivesCore = globalThis.__vibeusageRuntimePrimitivesCore;
if (!runtimePrimitivesCore) throw new Error("runtime primitives core not initialized");
const usageModelCore = globalThis.__vibeusageUsageModelCore;
if (!usageModelCore) throw new Error("usage-model core not initialized");
const usageMetricsCore = globalThis.__vibeusageUsageMetricsCore;
if (!usageMetricsCore) throw new Error("usage metrics core not initialized");

const { normalizeIso } = dateCore;
const { normalizeSource, toBigInt } = runtimePrimitivesCore;
const { normalizeUsageModel } = usageModelCore;
const { computeBillableTotalTokens } = usageMetricsCore;

function normalizeHourlyPayload(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    if (Array.isArray(data.hourly)) return data.hourly;
    if (Array.isArray(data.data)) return data.data;
    if (data.data && typeof data.data === "object" && Array.isArray(data.data.hourly)) {
      return data.data.hourly;
    }
  }
  return null;
}

function normalizeProjectHourlyPayload(data) {
  if (!data || typeof data !== "object") return null;
  if (Array.isArray(data.project_hourly)) return data.project_hourly;
  if (data.data && typeof data.data === "object" && Array.isArray(data.data.project_hourly)) {
    return data.data.project_hourly;
  }
  return null;
}

function normalizeDeviceSubscriptionsPayload(data) {
  if (!data || typeof data !== "object") return null;
  if (Array.isArray(data.device_subscriptions)) return data.device_subscriptions;
  if (data.data && typeof data.data === "object" && Array.isArray(data.data.device_subscriptions)) {
    return data.data.device_subscriptions;
  }
  return null;
}

function normalizeTextField(value, { lowerCase = false, maxLen = 128 } = {}) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const sliced = trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
  return lowerCase ? sliced.toLowerCase() : sliced;
}

function normalizeIsoField(value) {
  return normalizeIso(value);
}

function parseUtcHalfHourStart(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const dt = new Date(value);
  if (!Number.isFinite(dt.getTime())) return null;
  const minutes = dt.getUTCMinutes();
  if (
    (minutes !== 0 && minutes !== 30) ||
    dt.getUTCSeconds() !== 0 ||
    dt.getUTCMilliseconds() !== 0
  ) {
    return null;
  }
  const hourStart = new Date(
    Date.UTC(
      dt.getUTCFullYear(),
      dt.getUTCMonth(),
      dt.getUTCDate(),
      dt.getUTCHours(),
      minutes >= 30 ? 30 : 0,
      0,
      0,
    ),
  );
  return hourStart.toISOString();
}

function toNonNegativeBigInt(n) {
  if (typeof n === "bigint") return n >= 0n ? n : null;
  if (typeof n === "number") {
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null;
    return BigInt(n);
  }
  if (typeof n === "string") {
    const trimmed = n.trim();
    if (!/^[0-9]+$/.test(trimmed)) return null;
    try {
      return BigInt(trimmed);
    } catch (_error) {
      return null;
    }
  }
  return null;
}

function parseHourlyBucket(raw) {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid half-hour bucket" };

  const hourStart = parseUtcHalfHourStart(raw.hour_start);
  if (!hourStart) {
    return { ok: false, error: "hour_start must be an ISO timestamp at UTC half-hour boundary" };
  }

  const source = normalizeSource(raw.source);
  const model = normalizeUsageModel(raw.model) || DEFAULT_MODEL;
  const input = toNonNegativeBigInt(raw.input_tokens);
  const cached = toNonNegativeBigInt(raw.cached_input_tokens);
  const output = toNonNegativeBigInt(raw.output_tokens);
  const reasoning = toNonNegativeBigInt(raw.reasoning_output_tokens);
  const total = toNonNegativeBigInt(raw.total_tokens);

  if ([input, cached, output, reasoning, total].some((n) => n == null)) {
    return { ok: false, error: "Token fields must be non-negative integers" };
  }

  return {
    ok: true,
    value: {
      source,
      model,
      hour_start: hourStart,
      input_tokens: input.toString(),
      cached_input_tokens: cached.toString(),
      output_tokens: output.toString(),
      reasoning_output_tokens: reasoning.toString(),
      total_tokens: total.toString(),
    },
  };
}

function parseProjectHourlyBucket(raw) {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Invalid project half-hour bucket" };
  }

  const hourStart = parseUtcHalfHourStart(raw.hour_start);
  if (!hourStart) {
    return { ok: false, error: "hour_start must be an ISO timestamp at UTC half-hour boundary" };
  }

  const source = normalizeSource(raw.source);
  const projectKey = typeof raw.project_key === "string" ? raw.project_key.trim() : "";
  const projectRef = typeof raw.project_ref === "string" ? raw.project_ref.trim() : "";
  const input = toNonNegativeBigInt(raw.input_tokens);
  const cached = toNonNegativeBigInt(raw.cached_input_tokens);
  const output = toNonNegativeBigInt(raw.output_tokens);
  const reasoning = toNonNegativeBigInt(raw.reasoning_output_tokens);
  const total = toNonNegativeBigInt(raw.total_tokens);

  if (!projectKey) return { ok: false, error: "project_key is required" };
  if (!projectRef) return { ok: false, error: "project_ref is required" };
  if ([input, cached, output, reasoning, total].some((n) => n == null)) {
    return { ok: false, error: "Token fields must be non-negative integers" };
  }

  return {
    ok: true,
    value: {
      source,
      project_key: projectKey,
      project_ref: projectRef,
      hour_start: hourStart,
      input_tokens: input.toString(),
      cached_input_tokens: cached.toString(),
      output_tokens: output.toString(),
      reasoning_output_tokens: reasoning.toString(),
      total_tokens: total.toString(),
    },
  };
}

function parseDeviceSubscription(raw) {
  if (!raw || typeof raw !== "object") return null;

  const tool = normalizeTextField(raw.tool, { lowerCase: true, maxLen: 64 });
  const provider = normalizeTextField(raw.provider, { lowerCase: true, maxLen: 64 });
  const product = normalizeTextField(raw.product, { lowerCase: true, maxLen: 64 });
  const planType = normalizeTextField(raw.plan_type ?? raw.planType, {
    lowerCase: true,
    maxLen: 64,
  });

  if (!tool || !provider || !product || !planType) return null;

  return {
    tool,
    provider,
    product,
    plan_type: planType,
    rate_limit_tier: normalizeTextField(raw.rate_limit_tier ?? raw.rateLimitTier, {
      lowerCase: true,
      maxLen: 128,
    }),
    active_start: normalizeIsoField(raw.active_start ?? raw.activeStart),
    active_until: normalizeIsoField(raw.active_until ?? raw.activeUntil),
    last_checked: normalizeIsoField(raw.last_checked ?? raw.lastChecked),
  };
}

function buildRows({ hourly, tokenRow, nowIso, billableRuleVersion = BILLABLE_RULE_VERSION }) {
  const byHour = new Map();

  for (const raw of hourly) {
    const parsed = parseHourlyBucket(raw);
    if (!parsed.ok) return { error: parsed.error, data: [] };
    const source = parsed.value.source || "codex";
    const model = parsed.value.model || DEFAULT_MODEL;
    const dedupeKey = `${parsed.value.hour_start}::${source}::${model}`;
    byHour.set(dedupeKey, { ...parsed.value, source, model });
  }

  const rows = [];
  for (const bucket of byHour.values()) {
    const billable = computeBillableTotalTokens({ source: bucket.source, totals: bucket });
    rows.push({
      user_id: tokenRow.user_id,
      device_id: tokenRow.device_id,
      device_token_id: tokenRow.id,
      source: bucket.source,
      model: bucket.model,
      hour_start: bucket.hour_start,
      input_tokens: bucket.input_tokens,
      cached_input_tokens: bucket.cached_input_tokens,
      output_tokens: bucket.output_tokens,
      reasoning_output_tokens: bucket.reasoning_output_tokens,
      total_tokens: bucket.total_tokens,
      billable_total_tokens: billable.toString(),
      billable_rule_version: Number(toBigInt(billableRuleVersion) || 1n),
      updated_at: nowIso,
    });
  }

  return { error: null, data: rows };
}

function buildProjectRows({ hourly, tokenRow, nowIso }) {
  const byHour = new Map();

  for (const raw of hourly) {
    const parsed = parseProjectHourlyBucket(raw);
    if (!parsed.ok) return { error: parsed.error, data: [] };
    const source = parsed.value.source || "codex";
    const dedupeKey = `${parsed.value.hour_start}::${source}::${parsed.value.project_key}`;
    byHour.set(dedupeKey, { ...parsed.value, source });
  }

  const rows = [];
  for (const bucket of byHour.values()) {
    const billable = computeBillableTotalTokens({ source: bucket.source, totals: bucket });
    rows.push({
      user_id: tokenRow.user_id,
      device_id: tokenRow.device_id,
      device_token_id: tokenRow.id,
      source: bucket.source,
      project_key: bucket.project_key,
      project_ref: bucket.project_ref,
      hour_start: bucket.hour_start,
      input_tokens: bucket.input_tokens,
      cached_input_tokens: bucket.cached_input_tokens,
      output_tokens: bucket.output_tokens,
      reasoning_output_tokens: bucket.reasoning_output_tokens,
      total_tokens: bucket.total_tokens,
      billable_total_tokens: billable.toString(),
      billable_rule_version: Number(toBigInt(BILLABLE_RULE_VERSION) || 1n),
      updated_at: nowIso,
    });
  }

  return { error: null, data: rows };
}

function buildSubscriptionRows({ subscriptions, tokenRow, nowIso }) {
  const deduped = new Map();
  for (const raw of subscriptions) {
    const parsed = parseDeviceSubscription(raw);
    if (!parsed) continue;
    const key = `${parsed.tool}::${parsed.provider}::${parsed.product}`;
    deduped.set(key, parsed);
  }

  const rows = [];
  for (const subscription of deduped.values()) {
    rows.push({
      user_id: tokenRow.user_id,
      device_id: tokenRow.device_id,
      device_token_id: tokenRow.id,
      tool: subscription.tool,
      provider: subscription.provider,
      product: subscription.product,
      plan_type: subscription.plan_type,
      rate_limit_tier: subscription.rate_limit_tier,
      active_start: subscription.active_start,
      active_until: subscription.active_until,
      last_checked: subscription.last_checked,
      observed_at: nowIso,
      updated_at: nowIso,
    });
  }

  return { error: null, data: rows };
}

function deriveMetricsSource(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const sources = new Set();
  for (const row of rows) {
    const source = typeof row?.source === "string" ? row.source.trim() : "";
    if (source) sources.add(source);
  }
  if (sources.size === 1) return Array.from(sources)[0];
  if (sources.size > 1) return "mixed";
  return null;
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      BILLABLE_RULE_VERSION,
      DEFAULT_MODEL,
      buildProjectRows,
      buildRows,
      buildSubscriptionRows,
      deriveMetricsSource,
      normalizeDeviceSubscriptionsPayload,
      normalizeHourlyPayload,
      normalizeProjectHourlyPayload,
      parseDeviceSubscription,
      parseHourlyBucket,
      parseProjectHourlyBucket,
      parseUtcHalfHourStart,
      toNonNegativeBigInt,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}

export {
  BILLABLE_RULE_VERSION,
  DEFAULT_MODEL,
  buildProjectRows,
  buildRows,
  buildSubscriptionRows,
  deriveMetricsSource,
  normalizeDeviceSubscriptionsPayload,
  normalizeHourlyPayload,
  normalizeProjectHourlyPayload,
  parseDeviceSubscription,
  parseHourlyBucket,
  parseProjectHourlyBucket,
  parseUtcHalfHourStart,
  toNonNegativeBigInt,
};
