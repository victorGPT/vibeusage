import { describe, expect, it } from "vitest";

import { abbr, cost, daysBetween, full, pct, range } from "../format";
import { groupByCli, groupByModel } from "../grouping";
import { neighbours, pinnedMe } from "../rank";

describe("format", () => {
  it("abbreviates by magnitude", () => {
    expect(abbr(4_733_386_712)).toBe("4.73B");
    expect(abbr(1_041_345_076)).toBe("1.04B");
    expect(abbr(195_893_152)).toBe("195.9M");
    expect(abbr(652_510)).toBe("653K");
    expect(abbr(999)).toBe("999");
    expect(abbr(0)).toBe("0");
    expect(abbr("26100392")).toBe("26.1M");
  });

  it("carries a rounded value into the next unit", () => {
    expect(abbr(999_960_000)).toBe("1.00B");
    expect(abbr(999_700)).toBe("1.0M");
    expect(abbr(999.7)).toBe("1K");
  });

  it("formats full numbers, cost and percent", () => {
    expect(full(4_733_386_712)).toBe("4,733,386,712");
    expect(full("21410592118")).toBe("21,410,592,118");
    expect(full(undefined)).toBe("0");
    expect(cost("1456.46")).toBe("$1,456.46");
    expect(cost(8.031)).toBe("$8.03");
    expect(cost(undefined)).toBe("$0.00");
    expect(pct(22.0004)).toBe("22.0%");
    expect(pct(68.56)).toBe("68.6%");
  });

  it("counts inclusive days and joins a range", () => {
    expect(daysBetween("2025-11-13", "2026-11-12")).toBe(365);
    expect(daysBetween("2026-11-12", "2026-11-12")).toBe(1);
    expect(range("2026-11-06", "2026-11-12")).toBe("2026-11-06 → 2026-11-12");
    expect(range("1970-01-01", "9999-12-31")).toBe("All time");
  });
});

const entry = (rank: number) => ({ rank, display_name: `u${rank}`, total_tokens: 1000 - rank });

describe("neighbours", () => {
  it("returns up to n ranks on each side of me, in rank order", () => {
    const list = [9, 2, 4, 5, 6, 7, 8, 10, 11].map(entry);
    const { above, below } = neighbours(list, 7, 3);
    expect(above.map((e) => e.rank)).toEqual([4, 5, 6]);
    expect(below.map((e) => e.rank)).toEqual([8, 9, 10]);
  });

  it("shows what exists near the top", () => {
    const { above, below } = neighbours([1, 2, 3, 4, 5].map(entry), 1, 3);
    expect(above).toEqual([]);
    expect(below.map((e) => e.rank)).toEqual([2, 3, 4]);
  });

  it("returns nothing when I am unranked", () => {
    expect(neighbours([1, 2].map(entry), null, 3)).toEqual({ above: [], below: [] });
  });
});

describe("pinnedMe", () => {
  const me = { rank: 201, total_tokens: 5 };
  it("pins me when my rank is not on the page", () => {
    expect(pinnedMe([1, 2].map(entry), me)).toBe(me);
  });
  it("does not pin when my rank is on the page, I am unranked, or signed out", () => {
    expect(pinnedMe([200, 201].map(entry), me)).toBeNull();
    expect(pinnedMe([1].map(entry), { rank: null, total_tokens: 0 })).toBeNull();
    expect(pinnedMe([1].map(entry), null)).toBeNull();
  });
});

const BREAKDOWN = {
  sources: [
    {
      source: "claude",
      totals: { billable_total_tokens: 200, total_tokens: 999 },
      models: [
        { model: "claude-opus-4.5", totals: { total_tokens: 150 } },
        { model: "gpt-5.2", totals: { total_tokens: 50 } },
      ],
    },
    {
      source: "codex",
      totals: { total_tokens: 600 },
      models: [
        { model: "gpt-5.2", totals: { total_tokens: 120 } },
        { model_id: "openai/gpt-5.2-codex", totals: { total_tokens: 480 } },
      ],
    },
    { source: "every-code", totals: { total_tokens: 100 }, models: [] },
  ],
};
const NAMES = { codex: "Codex", claude: "Claude Code" };

describe("groupByCli", () => {
  it("lists one row per source, largest first, with its models by share", () => {
    expect(groupByCli(BREAKDOWN, NAMES)).toEqual([
      { key: "codex", label: "Codex", tokens: 600, detail: ["gpt-5.2-codex 80%", "gpt-5.2 20%"] },
      { key: "claude", label: "Claude Code", tokens: 200, detail: ["claude-opus-4.5 75%", "gpt-5.2 25%"] },
      { key: "every-code", label: "every-code", tokens: 100, detail: [] },
    ]);
  });
});

describe("groupByModel", () => {
  it("sums each model across sources and names the CLIs it came through", () => {
    expect(groupByModel(BREAKDOWN, NAMES)).toEqual([
      { key: "gpt-5.2-codex", label: "gpt-5.2-codex", tokens: 480, detail: ["Codex"] },
      { key: "gpt-5.2", label: "gpt-5.2", tokens: 170, detail: ["Claude Code", "Codex"] },
      { key: "claude-opus-4.5", label: "claude-opus-4.5", tokens: 150, detail: ["Claude Code"] },
    ]);
  });
});
