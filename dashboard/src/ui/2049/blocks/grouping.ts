import { resolveModelDisplayName } from "#src/lib/model-breakdown.ts";

import { tokens } from "./format";
import type { ModelBreakdown } from "./types";

export type ShareGroup = { key: string; label: string; tokens: number; detail: string[] };

const byTokens = (a: { tokens: number }, b: { tokens: number }) => b.tokens - a.tokens;

function sources(breakdown: ModelBreakdown, names: Record<string, string>) {
  return (breakdown.sources ?? []).map((s) => {
    const key = s.source ?? "";
    const models = (s.models ?? []).map((m) => ({
      name: String(resolveModelDisplayName(m, "")),
      tokens: tokens(m.totals),
    }));
    return { key, label: names[key] ?? key, tokens: tokens(s.totals), models };
  });
}

// One row per CLI; detail lists its models by share of that CLI, e.g. "gpt-5.2 64%".
export function groupByCli(breakdown: ModelBreakdown, names: Record<string, string>): ShareGroup[] {
  return sources(breakdown, names)
    .map((s) => ({
      key: s.key,
      label: s.label,
      tokens: s.tokens,
      detail: [...s.models]
        .sort(byTokens)
        .map((m) => `${m.name} ${s.tokens ? Math.round((m.tokens / s.tokens) * 100) : 0}%`),
    }))
    .sort(byTokens);
}

// One row per model summed across CLIs; detail names the CLIs it came through.
export function groupByModel(breakdown: ModelBreakdown, names: Record<string, string>): ShareGroup[] {
  const groups = new Map<string, ShareGroup>();
  for (const s of sources(breakdown, names)) {
    for (const m of s.models) {
      const g = groups.get(m.name) ?? { key: m.name, label: m.name, tokens: 0, detail: [] };
      g.tokens += m.tokens;
      if (!g.detail.includes(s.label)) g.detail.push(s.label);
      groups.set(m.name, g);
    }
  }
  return [...groups.values()].sort(byTokens);
}
