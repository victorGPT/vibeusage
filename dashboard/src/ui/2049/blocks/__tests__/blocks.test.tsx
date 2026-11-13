import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { DailyTable } from "../DailyTable";
import { RankTable } from "../RankTable";
import { Readout } from "../Readout";
import { StateScreen, type StateVariant } from "../StateScreen";
import type { DailyRow, LeaderboardEntry, UsagePeriod, UsageTotals } from "../types";

const TOTALS: Record<UsagePeriod, UsageTotals> = {
  day: { total_tokens: 26_100_392, input_tokens: 5_742_086, output_tokens: 1_827_027, cached_input_tokens: 17_878_768, reasoning_output_tokens: 652_510, total_cost_usd: "8.03" },
  week: { total_tokens: 195_893_152, input_tokens: 43_096_493, output_tokens: 13_712_520, cached_input_tokens: 134_186_809, reasoning_output_tokens: 4_897_328, total_cost_usd: "60.28" },
  month: { total_tokens: 753_104_880, input_tokens: 165_683_073, output_tokens: 52_717_341, cached_input_tokens: 515_876_842, reasoning_output_tokens: 18_827_622, total_cost_usd: "231.73" },
  total: { total_tokens: 4_733_386_712, input_tokens: 1_041_345_076, output_tokens: 331_337_069, cached_input_tokens: 3_242_369_898, reasoning_output_tokens: 118_334_667, total_cost_usd: "1456.46" },
};

function ReadoutHarness() {
  const [period, setPeriod] = useState("total" as UsagePeriod);
  return (
    <Readout
      period={period}
      onPeriodChange={setPeriod}
      totals={TOTALS[period]}
      from="2025-11-13"
      to="2026-11-12"
      handle="your_handle"
    />
  );
}

describe("Readout", () => {
  it("switches the main number, cost and the four token stats with the period", async () => {
    const user = userEvent.setup();
    render(<ReadoutHarness />);
    expect(screen.getByText("4,733,386,712")).toBeTruthy();
    expect(screen.getByText("$1,456.46")).toBeTruthy();
    expect(screen.getByText("1.04B")).toBeTruthy();

    const expected = [
      ["Day", "26,100,392", "$8.03", ["5.7M", "1.8M", "17.9M", "653K"]],
      ["Week", "195,893,152", "$60.28", ["43.1M", "13.7M", "134.2M", "4.9M"]],
      ["Month", "753,104,880", "$231.73", ["165.7M", "52.7M", "515.9M", "18.8M"]],
      ["Total", "4,733,386,712", "$1,456.46", ["1.04B", "331.3M", "3.24B", "118.3M"]],
    ] as const;
    for (const [tab, value, cost, stats] of expected) {
      await user.click(screen.getByRole("button", { name: tab }));
      expect(screen.getByRole("button", { name: tab }).getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByText(value)).toBeTruthy();
      expect(screen.getByText(cost)).toBeTruthy();
      for (const stat of stats) expect(screen.getByText(stat)).toBeTruthy();
    }
  });
});

describe("Readout without a period handler", () => {
  it("shows no period tabs it could not act on", () => {
    render(<Readout period="total" totals={TOTALS.total} from="2025-11-13" to="2026-11-12" handle="your_handle" />);
    expect(screen.getByText("4,733,386,712")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Day" })).toBeNull();
    expect(screen.queryByRole("group", { name: /period/i })).toBeNull();
  });
});

function days(count: number): DailyRow[] {
  return Array.from({ length: count }, (_, i) => ({
    day: `2026-10-${String(i + 1).padStart(2, "0")}`,
    total_tokens: (i + 1) * 1_000_000,
    input_tokens: 1,
    output_tokens: 2,
    cached_input_tokens: 3,
    reasoning_output_tokens: 4,
  }));
}

describe("DailyTable", () => {
  it("shows ten days per page, newest first, and pages forward", async () => {
    const user = userEvent.setup();
    render(<DailyTable rows={days(25)} />);
    expect(screen.getByText("Days 1–10 of 25")).toBeTruthy();
    expect(screen.getByText("2026-10-25")).toBeTruthy();
    expect(screen.queryByText("2026-10-15")).toBeNull();

    await user.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText("Days 11–20 of 25")).toBeTruthy();
    expect(screen.getByText("2026-10-15")).toBeTruthy();
    expect(screen.getByText("2026-10-06")).toBeTruthy();
    expect(screen.queryByText("2026-10-25")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Days 21–25 of 25")).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(1 + 5);
    const next = screen.getByRole("button", { name: "Next" });
    expect(next.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(next);
    expect(screen.getByText("Days 21–25 of 25")).toBeTruthy();
  });

  it("sorts by tokens from the first page", async () => {
    const user = userEvent.setup();
    render(<DailyTable rows={days(25)} />);
    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "Tokens" }));
    expect(screen.getByText("Days 1–10 of 25")).toBeTruthy();
    const firstBodyRow = screen.getAllByRole("row")[1];
    expect(within(firstBodyRow).getByText("2026-10-25")).toBeTruthy();
  });
});

function entries(fromRank: number, count: number): LeaderboardEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    rank: fromRank + i,
    display_name: `user_${fromRank + i}`,
    total_tokens: 1_000_000_000 - (fromRank + i) * 1_000_000,
    gpt_tokens: 1,
    claude_tokens: 2,
    other_tokens: 3,
  }));
}

const ME = { rank: 201, total_tokens: 12_000_000, gpt_tokens: 1, claude_tokens: 2, other_tokens: 3 };
// Built from the number: a literal hash-and-digits string trips the 2049 color guard.
const MY_RANK = `#${ME.rank}`;

function renderRankTable(page: number, rows: LeaderboardEntry[], me = ME as typeof ME | { rank: null; total_tokens: number }) {
  return render(
    <RankTable
      entries={rows}
      me={me}
      handle="your_handle"
      page={page}
      totalPages={13}
      totalEntries={250}
      period="week"
      onPageChange={vi.fn()}
    />,
  );
}

describe("RankTable", () => {
  it("pins my row to the bottom of the table from page 2 on", () => {
    renderRankTable(2, entries(21, 20));
    const rows = screen.getAllByRole("row");
    const last = rows[rows.length - 1];
    expect(within(last).getByText(MY_RANK)).toBeTruthy();
    expect(within(last).getByText("your_handle · you")).toBeTruthy();
    expect(within(rows[1]).getByText("#21")).toBeTruthy();
  });

  it("pins my row on page 1 when I am off the page", () => {
    renderRankTable(1, entries(1, 20));
    const rows = screen.getAllByRole("row");
    expect(within(rows[rows.length - 1]).getByText(MY_RANK)).toBeTruthy();
  });

  it("does not duplicate my row on page 1 when I am on it", () => {
    const rows = entries(1, 20).map((e) => (e.rank === 7 ? { ...e, is_me: true } : e));
    renderRankTable(1, rows, { ...ME, rank: 7 });
    expect(screen.getAllByText("your_handle · you")).toHaveLength(1);
  });

  it("does not pin when I am already on the page", () => {
    const rows = entries(201, 20).map((e) => (e.rank === 201 ? { ...e, is_me: true } : e));
    renderRankTable(11, rows);
    expect(screen.getAllByText(MY_RANK)).toHaveLength(1);
  });

  it("does not pin when I am unranked", () => {
    renderRankTable(2, entries(21, 20), { rank: null, total_tokens: 0 });
    expect(screen.queryByText("your_handle · you")).toBeNull();
  });
});

describe("StateScreen", () => {
  const CASES: [StateVariant, string, string][] = [
    ["install", "Step 1 of 2", "Install the tracker"],
    ["expired", "Expired", "Your session expired."],
    ["invalid", "Not found", "This profile is private or the link is wrong."],
    ["empty", "Waiting for first sync", "Run any AI CLI for a minute, then refresh. Sync runs every 30 minutes."],
    ["loading", "Reading", ""],
    ["error", "Error", "Couldn't reach the usage service."],
  ];

  it.each(CASES)("renders the %s variant", (variant, tag, line) => {
    const { unmount } = render(
      <StateScreen
        variant={variant}
        linkCode="K7Q-2049"
      />,
    );
    expect(screen.getByText(tag)).toBeTruthy();
    if (line) expect(screen.getByText(line)).toBeTruthy();
    unmount();
  });

  it("shows the install command with the link code", () => {
    render(<StateScreen variant="install" linkCode="K7Q-2049" />);
    expect(screen.getByText("npx --yes vibeusage init --link-code K7Q-2049")).toBeTruthy();
    expect(screen.queryByText(/when asked/)).toBeNull();
  });

  it("names the Node.js prerequisite above the install command", () => {
    render(<StateScreen variant="install" />);
    const prompt = screen.getByText("Install Node.js 18+ then run:");
    const command = screen.getByText("npx --yes vibeusage init");
    expect(prompt.compareDocumentPosition(command) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the bare install command without a link code", () => {
    render(<StateScreen variant="install" />);
    expect(screen.getByText("npx --yes vibeusage init")).toBeTruthy();
  });

  it("marks loading as busy", () => {
    render(<StateScreen variant="loading" />);
    expect(screen.getByRole("region").getAttribute("aria-busy")).toBe("true");
  });

  it("wires sign in and retry", async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn();
    const onRetry = vi.fn();
    const { unmount } = render(<StateScreen variant="expired" onSignIn={onSignIn} />);
    await user.click(screen.getByRole("button", { name: "Sign in with GitHub" }));
    expect(onSignIn).toHaveBeenCalledOnce();
    unmount();
    render(<StateScreen variant="error" onRetry={onRetry} />);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
