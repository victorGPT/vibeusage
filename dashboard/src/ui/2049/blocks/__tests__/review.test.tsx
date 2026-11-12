import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DailyTable } from "../DailyTable";
import { DotHeatmap } from "../DotHeatmap";
import { IdentityBar } from "../IdentityBar";
import { MyRank } from "../MyRank";
import { Projects } from "../Projects";
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

  it("shows the placeholder, not zero, when there are no rows and no rolling windows", () => {
    render(<Trend rows={[]} period="week" />);
    expect(screen.queryByText("0")).toBeNull();
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

  it("shows each subscription after the since label", () => {
    render(<IdentityBar handle="h" since="2025-11-16" activeDays={3} owner subscriptions={["Codex Pro", "Claude Code Max 20x"]} />);
    const since = screen.getByText("Since 2025-11-16 · 3 active days");
    const heading = screen.getByText("SUBSCRIPTIONS");
    const codex = screen.getByText("Codex Pro");
    expect(since.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(heading.compareDocumentPosition(codex) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Claude Code Max 20x")).toBeTruthy();
  });

  it("shows no subscription label when there is none", () => {
    const bare = render(<IdentityBar handle="h" since="2025-11-16" activeDays={3} owner />);
    const { container } = render(<IdentityBar handle="h" since="2025-11-16" activeDays={3} owner subscriptions={[]} />);
    expect(container.textContent).toBe(bare.container.textContent);
    expect(container.textContent).not.toContain("SUBSCRIPTIONS");
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

describe("MyRank under a channel metric", () => {
  it("counts tokens and the pass gap in the ranked channel", () => {
    const me = { rank: 2, total_tokens: 1000, gpt_tokens: 100 };
    const entries = [
      { rank: 1, display_name: "a", total_tokens: 200, gpt_tokens: 200 },
      { rank: 3, display_name: "c", total_tokens: 5000, gpt_tokens: 50 },
    ];
    render(<MyRank me={me} entries={entries} totalEntries={3} period="week" metric="gpt" from="2026-11-06" to="2026-11-12" handle="h" />);
    const region = screen.getByRole("region", { name: "My rank · Week · GPT" });
    expect(within(region).getByText("+100")).toBeTruthy();
    expect(within(region).getAllByText("100").length).toBeGreaterThan(0);
    expect(within(region).getByText("50")).toBeTruthy();
    expect(within(region).queryByText("5K")).toBeNull();
  });
});

describe("tied ranks", () => {
  const tied = [
    { rank: 1, user_id: "a", display_name: "a", total_tokens: 9 },
    { rank: 1, user_id: "b", display_name: "b", total_tokens: 9 },
    { rank: 2, user_id: "c", display_name: "c", total_tokens: 5 },
    { rank: 3, user_id: null, display_name: "Anonymous", total_tokens: 2 },
    { rank: 3, user_id: null, display_name: "Anonymous", total_tokens: 2 },
  ];

  it("keeps every tied row in RankList and RankTable", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <>
        <RankList entries={tied} period="week" handle="h" />
        <RankTable entries={tied} me={null} handle="h" page={1} totalPages={1} totalEntries={5} period="week" onPageChange={() => {}} />
      </>,
    );
    expect(screen.getAllByText("a")).toHaveLength(2);
    expect(screen.getAllByText("b")).toHaveLength(2);
    expect(screen.getAllByText("Anonymous")).toHaveLength(4);
    expect(error.mock.calls.some(([msg]) => String(msg).includes("same key"))).toBe(false);
    error.mockRestore();
  });
});

describe("RankList under a channel metric", () => {
  it("shows the ranked channel's tokens", () => {
    const entries = [{ rank: 1, display_name: "a", total_tokens: 5000, gpt_tokens: 300 }];
    render(<RankList entries={entries} period="week" metric="gpt" handle="h" />);
    expect(screen.getByText("300")).toBeTruthy();
    expect(screen.queryByText("5K")).toBeNull();
  });
});

describe("Pager at the last page", () => {
  it("keeps a disabled Next focusable so keyboard focus stays on it", () => {
    render(<RankTable entries={[]} me={null} handle="h" page={3} totalPages={3} totalEntries={0} period="week" onPageChange={() => {}} />);
    const next = screen.getByRole("button", { name: "Next" });
    next.focus();
    expect(document.activeElement).toBe(next);
    expect(next.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("Trend export", () => {
  it("colors the chart with SVG attributes, which the Share on X image export keeps", () => {
    const rows = [{ day: "2026-11-01", total_tokens: 10 }, { day: "2026-11-02", total_tokens: 30 }];
    const { container } = render(<Trend rows={rows} period="week" />);
    const svg = container.querySelector("svg[role=img]")!;
    const painted = [...svg.querySelectorAll("line, path")].map((el) => [el.getAttribute("stroke"), el.getAttribute("fill")]);
    expect(painted).toEqual([
      ["var(--color-border)", null],
      ["var(--color-border)", null],
      ["var(--color-input)", null],
      [null, "var(--color-primary)"],
      ["var(--color-primary)", "none"],
    ]);
  });
});

describe("links", () => {
  it("opens a project's repo in a new tab and says so", () => {
    render(<Projects entries={[{ project_key: "acme/rocket", project_ref: "https://github.com/acme/rocket", total_tokens: 5 }]} limit={3} />);
    const link = screen.getByRole("link", { name: "rocket (opens in a new tab)" });
    expect(link.getAttribute("href")).toBe("https://github.com/acme/rocket");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("keeps an internal profile link in the same tab", () => {
    const rows = [{ rank: 1, display_name: "nullbyte", total_tokens: 9 }];
    render(<RankList entries={rows} period="week" handle="me" profileHref={() => "/u/nullbyte"} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/u/nullbyte");
    expect(link.hasAttribute("target")).toBe(false);
    expect(link.textContent).not.toContain("new tab");
  });
});

describe("unsafe links", () => {
  it.each(["javascript:alert(1)", " JavaScript:alert(1)", "data:text/html,x", "//evil.example/x", "/\\evil.example/x"])(
    "renders %s as plain text, not a link",
    (href) => {
      render(<Projects entries={[{ project_key: "acme/rocket", project_ref: href, total_tokens: 5 }]} limit={3} />);
      expect(screen.queryByRole("link")).toBeNull();
      expect(screen.getByText("rocket")).toBeTruthy();
    },
  );
});
