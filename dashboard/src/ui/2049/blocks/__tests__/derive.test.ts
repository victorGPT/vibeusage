import { describe, expect, it } from "vitest";

import { axisLabel, identicon, monthLabels, trendPath } from "../derive";
import { ahead } from "../rank";

describe("identicon", () => {
  it("draws 25 cells whose columns mirror around the middle", () => {
    const cells = identicon("your_handle");
    expect(cells).toHaveLength(25);
    for (let r = 0; r < 5; r++) {
      expect(cells[r * 5]).toBe(cells[r * 5 + 4]);
      expect(cells[r * 5 + 1]).toBe(cells[r * 5 + 3]);
    }
    expect(identicon("your_handle")).toEqual(cells);
    expect(identicon("nullbyte")).not.toEqual(cells);
  });
});

describe("monthLabels", () => {
  it("names the month each twelfth of the week columns starts in", () => {
    const week = (day: string) => [null, { day, value: 1, level: 1 }];
    const weeks = Array.from({ length: 24 }, (_, i) => week(`2026-${String(Math.floor(i / 2) + 1).padStart(2, "0")}-05`));
    expect(monthLabels(weeks)).toEqual(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
  });
});

describe("trendPath", () => {
  it("scales the peak to the top and closes the area on the baseline", () => {
    expect(trendPath([0, 10, 5])).toEqual({
      line: "M0.0 118.0 L280.0 8.0 L560.0 63.0",
      area: "M0.0 118.0 L280.0 8.0 L560.0 63.0 L560 120 L0 120 Z",
    });
    expect(trendPath([])).toEqual({ line: "", area: "" });
  });
});

describe("axisLabel", () => {
  it("shortens each date key", () => {
    expect(axisLabel("2026-10-14", "day")).toBe("10-14");
    expect(axisLabel("2026-11-12T13:00:00", "hour")).toBe("13:00");
    expect(axisLabel("2026-10", "month")).toBe("2026-10");
  });
});

describe("ahead", () => {
  it("finds the entry one rank above me", () => {
    const list = [5, 6, 8].map((rank) => ({ rank, total_tokens: 100 - rank }));
    expect(ahead(list, { rank: 7, total_tokens: 1 })).toEqual({ rank: 6, total_tokens: 94 });
    expect(ahead(list, { rank: 1, total_tokens: 1 })).toBeUndefined();
    expect(ahead(list, null)).toBeUndefined();
  });
});
