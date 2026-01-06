import { toFiniteNumber } from "./format.js";

function normalizeModelId(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

function resolveModelId(model) {
  const id = normalizeModelId(model?.model_id);
  if (id) return id;
  return null;
}

function resolveModelName(model, fallback) {
  if (model?.model) return String(model.model);
  return fallback;
}

export function buildFleetData(modelBreakdown, { copyFn } = {}) {
  const safeCopy = typeof copyFn === "function" ? copyFn : (key) => key;
  const sources = Array.isArray(modelBreakdown?.sources)
    ? modelBreakdown.sources
    : [];
  const normalizedSources = sources
    .map((entry) => {
      const totalTokens = toFiniteNumber(entry?.totals?.total_tokens);
      const totalCost = toFiniteNumber(entry?.totals?.total_cost_usd);
      return {
        source: entry?.source,
        totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0,
        totalCost: Number.isFinite(totalCost) ? totalCost : 0,
        models: Array.isArray(entry?.models) ? entry.models : [],
      };
    })
    .filter((entry) => entry.totalTokens > 0);

  if (!normalizedSources.length) return [];

  const grandTotal = normalizedSources.reduce(
    (acc, entry) => acc + entry.totalTokens,
    0
  );
  const pricingMode =
    typeof modelBreakdown?.pricing?.pricing_mode === "string"
      ? modelBreakdown.pricing.pricing_mode.toUpperCase()
      : null;

  return normalizedSources
    .slice()
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .map((entry) => {
      const label = entry.source
        ? String(entry.source).toUpperCase()
        : safeCopy("shared.placeholder.short");
      const totalPercentRaw =
        grandTotal > 0 ? (entry.totalTokens / grandTotal) * 100 : 0;
      const totalPercent = Number.isFinite(totalPercentRaw)
        ? totalPercentRaw.toFixed(1)
        : "0.0";
      const models = entry.models
        .map((model) => {
          const modelTokens = toFiniteNumber(model?.totals?.total_tokens);
          if (!Number.isFinite(modelTokens) || modelTokens <= 0) return null;
          const share =
            entry.totalTokens > 0
              ? Math.round((modelTokens / entry.totalTokens) * 1000) / 10
              : 0;
          const name = resolveModelName(model, safeCopy("shared.placeholder.short"));
          const id = resolveModelId(model);
          return { id, name, share, usage: modelTokens, calc: pricingMode };
        })
        .filter(Boolean);
      return {
        label,
        totalPercent: String(totalPercent),
        usd: entry.totalCost,
        usage: entry.totalTokens,
        models,
      };
    });
}

export function buildTopModels(modelBreakdown, { limit = 3, copyFn } = {}) {
  const safeCopy = typeof copyFn === "function" ? copyFn : (key) => key;
  const sources = Array.isArray(modelBreakdown?.sources)
    ? modelBreakdown.sources
    : [];
  if (!sources.length) return [];

  const totalsById = new Map();
  const nameById = new Map();
  const nameWeight = new Map();
  let totalTokensAll = 0;

  for (const source of sources) {
    const models = Array.isArray(source?.models) ? source.models : [];
    for (const model of models) {
      const tokens = toFiniteNumber(model?.totals?.total_tokens);
      if (!Number.isFinite(tokens) || tokens <= 0) continue;
      totalTokensAll += tokens;
      const id = resolveModelId(model);
      if (!id) continue;
      const name = resolveModelName(model, safeCopy("shared.placeholder.short"));
      totalsById.set(id, (totalsById.get(id) || 0) + tokens);
      const currentWeight = nameWeight.get(id) || 0;
      if (tokens >= currentWeight) {
        nameWeight.set(id, tokens);
        nameById.set(id, name);
      }
    }
  }

  if (!totalsById.size) return [];

  const knownTotal = Array.from(totalsById.values()).reduce(
    (acc, value) => acc + value,
    0
  );
  const totalTokens = totalTokensAll > 0 ? totalTokensAll : knownTotal;

  const normalizedLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 3;
  return Array.from(totalsById.entries())
    .map(([id, tokens]) => {
      const percent =
        totalTokens > 0 ? ((tokens / totalTokens) * 100).toFixed(1) : "0.0";
      return {
        id,
        name: nameById.get(id) || safeCopy("shared.placeholder.short"),
        tokens,
        percent: String(percent),
      };
    })
    .sort((a, b) => {
      if (b.tokens !== a.tokens) return b.tokens - a.tokens;
      return String(a.name).localeCompare(String(b.name));
    })
    .slice(0, normalizedLimit);
}
