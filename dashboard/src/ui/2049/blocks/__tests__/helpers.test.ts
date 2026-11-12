import { describe, expect, it } from "vitest";

import { abbr, cost, daysBetween, full, pct, range } from "../format";

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
