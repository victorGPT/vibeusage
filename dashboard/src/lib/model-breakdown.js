import { toFiniteNumber } from "./format.js";

export function buildFleetData(modelBreakdown, { copyFn } = {}) {
  const safeCopy = typeof copyFn === "function" ? copyFn : (key) => key;
  const sources = Array.isArray(modelBreakdown?.sources)
    ? modelBreakdown.sources
    : [];
  const normalizedSources = sources
    .map((entry) => {
      const totalTokens = toFiniteNumber(
        entry?.totals?.billable_total_tokens ?? entry?.totals?.total_tokens
      );
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
          const modelTokens = toFiniteNumber(
            model?.totals?.billable_total_tokens ?? model?.totals?.total_tokens
          );
          if (!Number.isFinite(modelTokens) || modelTokens <= 0) return null;
          const share =
            entry.totalTokens > 0
              ? Math.round((modelTokens / entry.totalTokens) * 1000) / 10
              : 0;
          const name = model?.model
            ? String(model.model)
            : safeCopy("shared.placeholder.short");
          return { name, share, usage: modelTokens, calc: pricingMode };
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
