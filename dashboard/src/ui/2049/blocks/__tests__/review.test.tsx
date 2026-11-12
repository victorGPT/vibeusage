import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DailyTable } from "../DailyTable";
import { DotHeatmap } from "../DotHeatmap";
import { IdentityBar } from "../IdentityBar";
import { MyRank } from "../MyRank";
import { RankRail } from "../RankRail";
import { RankTable } from "../RankTable";
import { Readout } from "../Readout";
import { RankList } from "../RankList";
import { Trend } from "../Trend";
import type { DailyRow } from "../types";

// Cases added by the contract review: missing rows, hour and month keys, asOf, signed-out viewers.

const hours: DailyRow[] = [
  { hour: "2026-11-12T13:00:00", total_tokens: 30, input_tokens: 1 },
  { hour: "2026-11-12T13:30:00", missing: true },
  { hour: "2026-11-12T14:00:00", total_tokens: 10, future: true },
];

describe("DailyTable keys and states", () => {
  it("reads the hour key, marks unsynced rows and drops future ones", () => {
    render(<DailyTable rows={hours} dateKey="hour" />);
    expect(screen.getByText("2026-11-12 13:00")).toBeTruthy();
    expect(screen.getByText("Hours 1–2 of 2")).toBeTruthy();
    const missing = screen.getAllByRole("row")[1];
    expect(within(missing).getByText("2026-11-12 13:30")).toBeTruthy();
    expect(within(missing).getAllByText("WAIT_AUTO_SYNC")).toHaveLength(5);
    expect(screen.queryByText("2026-11-12 14:00")).toBeNull();
  });

  it("shows every row and no pager when not paged", () => {
    const months = Array.from({ length: 14 }, (_, i) => ({ month: `2025-${String(i + 1).padStart(2, "0")}`, total_tokens: i }));
    render(<DailyTable rows={months} dateKey="month" paged={false} />);
    expect(screen.getAllByRole("row")).toHaveLength(1 + 14);
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  });
});

describe("Readout asOf", () => {
  it("divides by the days that have passed, not the whole range", () => {
    render(
      <Readout
        period="week"
        totals={{ total_tokens: 30_000_000 }}
        from="2026-11-06"
        to="2026-11-12"
        asOf="2026-11-08"
        handle="your_handle"
      />,
    );
    expect(screen.getByText("10.0M tokens a day.")).toBeTruthy();
  });

  it("uses the billable total for the headline when the API sends it", () => {
    render(
      <Readout period="total" totals={{ total_tokens: 900, billable_total_tokens: 800 }} from="2026-11-12" to="2026-11-12" handle="h" />,
    );
    expect(screen.getByText("800")).toBeTruthy();
  });
});

describe("signed-out viewers", () => {
  const entries = [1, 2, 3].map((rank) => ({ rank, display_name: `u${rank}`, total_tokens: 100 - rank }));

  it("RankRail and MyRank show the placeholder and no you row", () => {
    render(
      <>
        <RankRail me={null} entries={entries} totalEntries={3} from="2026-11-06" to="2026-11-12" handle="h" leaderboardHref="#" />
        <MyRank me={null} entries={entries} totalEntries={3} period="week" from="2026-11-06" to="2026-11-12" handle="h" />
      </>,
    );
    expect(screen.getAllByText("--")).toHaveLength(2);
    expect(screen.queryByText(/· you/)).toBeNull();
  });

  it("RankTable pins nothing", () => {
    render(
      <RankTable
        entries={entries}
        me={null}
        handle="h"
        page={1}
        totalPages={1}
        totalEntries={3}
        period="week"
        onPageChange={() => {}}
      />,
    );
    expect(screen.getAllByRole("row")).toHaveLength(1 + 3);
  });
});

describe("Trend keys", () => {
  it("labels the axis from the month key and follows the period", () => {
    const rows = [
      { month: "2026-09", total_tokens: 5 },
      { month: "2026-10", total_tokens: 9 },
      { month: "2026-11", total_tokens: 7 },
    ];
    render(<Trend rows={rows} dateKey="month" period="total" />);
    expect(screen.getByText("Trend · Total")).toBeTruthy();
    expect(screen.getByText("2026-09")).toBeTruthy();
    expect(screen.getByText("Peak 9 · 2026-10")).toBeTruthy();
    expect(screen.getByText("2026-11")).toBeTruthy();
  });
});

describe("Trend windows without rolling", () => {
  it("does not pass months off as the last 7 or 30 days", () => {
    const rows = [
      { month: "2026-09", total_tokens: 5_000_000 },
      { month: "2026-10", total_tokens: 9_000_000 },
    ];
    render(<Trend rows={rows} dateKey="month" period="total" />);
    expect(screen.queryByText("14.0M")).toBeNull();
    expect(screen.getAllByText("--")).toHaveLength(3);
  });

  it("sums only the last 30 daily rows", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({
      day: `2026-10-${String(i + 1).padStart(2, "0")}`,
      total_tokens: 1_000_000,
    }));
    render(<Trend rows={rows} period="month" />);
    expect(screen.getByText("7.0M")).toBeTruthy();
    expect(screen.getByText("30.0M")).toBeTruthy();
    expect(screen.getByText("1.0M")).toBeTruthy();
  });
});

describe("rank deltas when a page has them", () => {
  const rows = [
    { rank: 1, display_name: "nullbyte", total_tokens: 9, delta: 0 },
    { rank: 2, display_name: "kernel_panic", total_tokens: 8, delta: -2 },
  ];

  it("shows each row's delta in RankList", () => {
    render(<RankList entries={rows} period="week" handle="me" />);
    expect(screen.getByText("▼ 2")).toBeTruthy();
  });

  it("reads my delta from me in MyRank and RankRail", () => {
    const me = { rank: 2, total_tokens: 8, delta: -2 };
    const myRank = <MyRank me={me} entries={rows} totalEntries={2} period="week" from="2026-11-06" to="2026-11-12" handle="me" />;
    const { unmount } = render(myRank);
    expect(screen.getAllByText("▼ 2").length).toBeGreaterThan(0);
    unmount();
    render(<RankRail me={me} entries={rows} totalEntries={2} from="2026-11-06" to="2026-11-12" handle="me" leaderboardHref="/leaderboard" />);
    expect(screen.getAllByText("▼ 2").length).toBeGreaterThan(0);
  });

  it("shows each row's delta next to the rank in RankTable", () => {
    render(<RankTable entries={rows} me={null} handle="me" page={1} totalPages={1} totalEntries={2} period="week" onPageChange={() => {}} />);
    expect(screen.getByText("▼ 2")).toBeTruthy();
  });
});

describe("IdentityBar", () => {
  it("disables the public switch while saving", () => {
    render(<IdentityBar handle="h" owner publicEnabled publicBusy />);
    const toggle = screen.getByRole("switch");
    expect(toggle.getAttribute("aria-disabled") === "true" || toggle.hasAttribute("data-disabled")).toBe(true);
  });

  it("holds the share link until the public setting is saved", () => {
    render(<IdentityBar handle="h" owner publicEnabled publicBusy />);
    expect(screen.getByRole("button", { name: "Copy share link" }).hasAttribute("disabled")).toBe(true);
  });
});

describe("DotHeatmap", () => {
  it("walks the days with the keyboard and reads them out", async () => {
    const user = userEvent.setup();
    const week = [
      { day: "2026-11-08", value: 1000, level: 1 },
      { day: "2026-11-09", value: 2_000_000, level: 3 },
    ];
    render(<DotHeatmap heatmap={{ from: "2026-11-08", to: "2026-11-09", weeks: [week] }} handle="h" />);
    expect(screen.getByText("Dot size = tokens that day")).toBeTruthy();
    await user.tab();
    expect(screen.getByText("2026-11-09 · 2.0M tokens")).toBeTruthy();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByText("2026-11-08 · 1K tokens")).toBeTruthy();
    fireEvent.blur(screen.getByRole("img"));
    expect(screen.getByText("Dot size = tokens that day")).toBeTruthy();
  });
});

describe("MyRank metric", () => {
  const me = { rank: 2, total_tokens: 50 };
  const entries = [1, 2, 3].map((rank) => ({ rank, display_name: `u${rank}`, total_tokens: 100 - rank }));

  it("names the metric the ranks were sorted by", () => {
    const { rerender } = render(
      <MyRank me={me} entries={entries} totalEntries={3} period="week" metric="gpt" from="2026-11-06" to="2026-11-12" handle="h" />,
    );
    expect(screen.getByRole("region", { name: "My rank · Week · GPT" })).toBeTruthy();
    rerender(<MyRank me={me} entries={entries} totalEntries={3} period="week" metric="all" from="2026-11-06" to="2026-11-12" handle="h" />);
    expect(screen.getByRole("region", { name: "My rank · Week · all models" })).toBeTruthy();
  });
});
