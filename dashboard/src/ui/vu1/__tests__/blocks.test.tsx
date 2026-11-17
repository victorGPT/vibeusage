import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setSoundEnabled } from "#src/ui/hardware/lib/sound.ts";

import { InstallCommand } from "../InstallCommand";
import { InstallKey, ShareKey } from "../Keys";
import { periodOptions } from "../labels";
import { ModelList } from "../ModelList";
import { MyRankLcd } from "../MyRankLcd";
import { Pager } from "../Pager";
import { RankScreen } from "../RankScreen";
import { Segment, SourceSegment } from "../SourceSegment";
import { StateScreen, type StateVariant } from "../StateScreen";
import { StatMinis } from "../StatMinis";
import { TopBar } from "../TopBar";
import type { DailyRow, Heatmap, LeaderboardEntry, ModelBreakdown } from "../types";
import { UpgradeToast } from "../UpgradeToast";
import { UsageScreen } from "../UsageScreen";

// jsdom has no pointer capture or Web Animations; the kit's switch and the SDK tabs call them.
beforeAll(() => {
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.getAnimations ??= () => [];
});

beforeEach(() => {
  const store = new Map();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    },
  });
});

const DAYS = ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"];
const ROWS: DailyRow[] = DAYS.map((day, i) => ({ day, total_tokens: (i + 1) * 1_000_000 }));

// Two weeks, Sunday-first like the API: the second week ends on 2026-11-14.
const HEATMAP: Heatmap = {
  from: "2026-11-01",
  to: "2026-11-14",
  weeks: [
    ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"].map((day, i) => ({ day, value: i * 1_000_000, level: i % 5 })),
    ["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"].map((day, i) => ({ day, value: (i + 1) * 2_000_000, level: (i + 1) % 5 })),
  ],
};

const ENTRIES: LeaderboardEntry[] = [
  { rank: 35, display_name: "karpathy_fan", total_tokens: 520_000_000, gpt_tokens: 100, claude_tokens: 500, other_tokens: 0 },
  { rank: 36, display_name: "0xmerge", total_tokens: 400_000_000, gpt_tokens: 900, claude_tokens: 10, other_tokens: 0 },
  { rank: 37, display_name: "ada", is_me: true, total_tokens: 398_800_000, gpt_tokens: 0, claude_tokens: 0, other_tokens: 5 },
];

describe("Segment with the periods", () => {
  it("reports the period id picked by click or arrow key", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Segment label="Period" options={periodOptions()} value="week" onChange={onChange} />);
    const week = screen.getByRole("radio", { name: "Week" });
    expect(week).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Total" }));
    expect(onChange).toHaveBeenLastCalledWith("total");
    week.focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("month");
  });
});

describe("SourceSegment", () => {
  it("reports the source id, not its label", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SourceSegment sources={["all", "claude", "codex"]} value="all" onChange={onChange} />);
    await user.click(screen.getByText("Codex"));
    expect(onChange).toHaveBeenLastCalledWith("codex");
  });

  it("is one tab stop and moves with arrow keys", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SourceSegment sources={["all", "claude", "codex"]} value="all" onChange={onChange} />);
    await user.tab();
    expect(document.activeElement).toHaveTextContent("All");
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("claude");
  });
});

describe("UsageScreen", () => {
  const props = {
    range: "Nov 10 – Nov 16",
    totals: { total_tokens: 412_000_000, total_cost_usd: "648.3" },
    rank: 37,
    delta: { tokens: 0.09, cost: 52.8, rank: 3 },
    rows: ROWS,
    heatmap: HEATMAP,
  };

  it("reads tokens, cost and rank with their changes", () => {
    render(<UsageScreen {...props} />);
    expect(screen.getByText("412.0M")).toBeTruthy();
    expect(screen.getByText("$648.30")).toBeTruthy();
    expect(screen.getByText("#37")).toBeTruthy();
    expect(screen.getByText("+9% from previous period")).toBeTruthy();
    expect(screen.getByText("+$52.80")).toBeTruthy();
    expect(screen.getByText("▲ 3")).toBeTruthy();
    expect(screen.getByRole("group", { name: /peak 7\.0M/ })).toBeTruthy();
  });

  it("draws a week as seven slots even when only two days have passed", () => {
    const week: DailyRow[] = ["2025-12-29", "2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"].map((day, i) => ({
      day,
      total_tokens: i < 2 ? (i + 1) * 1_000_000 : 0,
      future: i >= 2,
    }));
    render(<UsageScreen {...props} rows={week} />);
    const bars = screen.getByRole("group", { name: /peak 2\.0M/ }).querySelectorAll('[data-kit="bar-graph-bar"]');
    expect(bars).toHaveLength(7);
    expect([...bars].map((bar) => (bar as HTMLElement).style.getPropertyValue("--v"))).toEqual(["0.5", "1", "0", "0", "0", "0", "0"]);
    expect(screen.getByText("Dec 29")).toBeTruthy();
    expect(screen.getByText("Jan 4")).toBeTruthy();
  });

  // Spans marked data-vu1-wide drop out at phone widths (blocks.css), so a phone reads the rest.
  const axisLabels = () => {
    const spans = [...document.querySelectorAll('[data-vu1="axis"] > span')];
    return { all: spans.map((s) => s.textContent), phone: spans.filter((s) => !s.hasAttribute("data-vu1-wide")).map((s) => s.textContent) };
  };
  const days = (from: string, n: number): DailyRow[] =>
    Array.from({ length: n }, (_, i) => ({ day: new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10), total_tokens: 1 }));

  it("keeps every other week label on a phone, first and last among them", () => {
    render(<UsageScreen {...props} rows={days("2025-11-16", 7)} />);
    expect(axisLabels()).toEqual({
      all: ["Nov 16", "Nov 17", "Nov 18", "Nov 19", "Nov 20", "Nov 21", "Nov 22"],
      phone: ["Nov 16", "Nov 18", "Nov 20", "Nov 22"],
    });
  });

  it("thins the month keys of a short total on a phone, last month kept", () => {
    const months: DailyRow[] = ["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12"].map((month) => ({ month, total_tokens: 1 }));
    render(<UsageScreen {...props} rows={months} dateKey="month" />);
    const { all, phone } = axisLabels();
    expect(all).toHaveLength(6);
    expect(phone[0]).toBe("2025-07");
    expect(phone.at(-1)).toBe("2025-12");
    expect(phone.length).toBeLessThanOrEqual(4);
  });

  it("keeps all five labels of a month on a phone", () => {
    render(<UsageScreen {...props} rows={days("2025-11-01", 30)} />);
    const { all, phone } = axisLabels();
    expect(all).toHaveLength(5);
    expect(phone).toEqual(all);
  });

  it("reads a bar's day and tokens on hover", async () => {
    const user = userEvent.setup();
    render(<UsageScreen {...props} />);
    const bars = screen.getByRole("group", { name: /peak 7\.0M/ }).querySelectorAll('[data-kit="bar-graph-bar"]');
    await user.hover(bars[5]);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Nov 15 · 6.0M tokens");
  });

  it("is one tab stop on the latest day, and arrow keys step the read between bars", async () => {
    const user = userEvent.setup();
    render(<UsageScreen {...props} />);
    const tip = () => screen.getByRole("tooltip");
    const bars = [...screen.getByRole("group", { name: /peak/ }).querySelectorAll('[data-kit="bar-graph-bar"]')] as HTMLElement[];
    expect(bars.filter((bar) => bar.tabIndex === 0)).toEqual([bars[6]]);
    act(() => bars[6].focus());
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Nov 16 · 7.0M tokens");
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(bars[5]);
    expect(tip()).toHaveTextContent("Nov 15 · 6.0M tokens");
    await user.keyboard("{Home}");
    expect(tip()).toHaveTextContent("Nov 10 · 1.0M tokens");
    await user.keyboard("{ArrowRight}");
    expect(tip()).toHaveTextContent("Nov 11 · 2.0M tokens");
  });

  it("keeps one tab stop when the period shrinks under the picked bar", () => {
    const month: DailyRow[] = Array.from({ length: 30 }, (_, i) => ({ day: `2026-11-${String(i + 1).padStart(2, "0")}`, total_tokens: 1_000_000 }));
    const { rerender } = render(<UsageScreen {...props} rows={month} />);
    const monthBars = [...screen.getByRole("group", { name: /peak/ }).querySelectorAll('[data-kit="bar-graph-bar"]')] as HTMLElement[];
    act(() => {
      monthBars[25].focus();
    });
    rerender(<UsageScreen {...props} />);
    const bars = [...screen.getByRole("group", { name: /peak/ }).querySelectorAll('[data-kit="bar-graph-bar"]')] as HTMLElement[];
    expect(bars.filter((bar) => bar.tabIndex === 0)).toEqual([bars[6]]);
  });

  it("reads a day with nothing as no usage, and skips days still to come", async () => {
    const user = userEvent.setup();
    const week: DailyRow[] = DAYS.map((day, i) => ({ day, total_tokens: i === 1 ? 0 : 1_000_000, future: i >= 3 }));
    render(<UsageScreen {...props} rows={week} />);
    const bars = [...screen.getByRole("group", { name: /peak/ }).querySelectorAll('[data-kit="bar-graph-bar"]')];
    act(() => (bars[2] as HTMLElement).focus());
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Nov 12 · 1.0M tokens");
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Nov 11 · no usage");
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(bars[2]);
    expect(bars.slice(3).every((bar) => !bar.hasAttribute("tabindex"))).toBe(true);
  });

  it("explains how cost is priced in a tooltip on its label", async () => {
    render(<UsageScreen {...props} />);
    act(() => screen.getByText("Cost").focus());
    expect(await screen.findByRole("tooltip")).toHaveTextContent("priced at the model's own rate");
  });

  it("reads out the latest day before any day is picked, with no instructions", async () => {
    const user = userEvent.setup();
    render(<UsageScreen {...props} />);
    await user.click(screen.getByRole("tab", { name: "Activity" }));
    expect(screen.getByText("2026-11-14 · 14.0M tokens")).toBeTruthy();
    expect(screen.queryByText(/arrow keys or hover/i)).toBeNull();
  });

  it("switches to the activity dots and walks days with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<UsageScreen {...props} />);
    await user.click(screen.getByRole("tab", { name: "Activity" }));
    expect(screen.getByRole("tab", { name: "Activity" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Last 52 weeks")).toBeTruthy();
    const dots = screen.getByRole("img", { name: /Arrow keys move between days/ });
    act(() => dots.focus());
    expect(screen.getByText("2026-11-14 · 14.0M tokens")).toBeTruthy();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByText("2026-11-07 · 6.0M tokens")).toBeTruthy();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByText("2026-11-06 · 5.0M tokens")).toBeTruthy();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("2026-11-13 · 12.0M tokens")).toBeTruthy();
    await user.keyboard("{Home}");
    expect(screen.getByText("2026-11-01 · no usage")).toBeTruthy();
  });

  it("puts the tabs and the dots on the tab order", async () => {
    const user = userEvent.setup();
    render(<UsageScreen {...props} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Usage" }));
    await user.keyboard("{ArrowRight}{Enter}");
    expect(screen.getByRole("tab", { name: "Activity" })).toHaveAttribute("aria-selected", "true");
    await user.tab();
    expect(document.activeElement).toBe(screen.getByText("Cost"));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("img", { name: /Arrow keys move between days/ }));
  });
});

describe("StatMinis", () => {
  it("shows the rolling windows and the peak day", () => {
    render(<StatMinis rows={ROWS} rolling={{ last_7d: { totals: { billable_total_tokens: 412_000_000 } }, last_30d: { totals: { billable_total_tokens: 1_840_000_000 }, avg_per_active_day: 63_400_000 } }} />);
    for (const text of ["Last 7 days", "412.0M", "Last 30 days", "1.84B", "Average per active day", "63.4M", "Peak · Nov 16", "7.0M"]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
  });

  it("falls back to the daily rows without rolling windows", () => {
    render(<StatMinis rows={ROWS} />);
    expect(screen.getAllByText("28.0M")).toHaveLength(2);
    expect(screen.getByText("4.0M")).toBeTruthy();
  });
});

describe("ModelList", () => {
  const breakdown: ModelBreakdown = {
    sources: [
      { source: "claude", totals: { total_tokens: 900 }, models: ["a", "b", "c", "d"].map((m, i) => ({ model_id: m, display_model: `Model ${m}`, totals: { total_tokens: 400 - i * 100, total_cost_usd: 1 } })) },
      { source: "codex", totals: { total_tokens: 100 }, models: [{ model_id: "e", display_model: "Model e", totals: { total_tokens: 60, total_cost_usd: 2 } }, { model_id: "f", display_model: "Model f", totals: { total_tokens: 40 } }] },
    ],
  };

  it("lists the top five models with the first one marked", () => {
    render(<ModelList breakdown={breakdown} />);
    const rows = within(screen.getByRole("table", { name: "Top models" })).getAllByRole("row");
    expect(rows).toHaveLength(6);
    expect(rows[1]).toHaveAttribute("data-me", "true");
    expect(within(rows[1]).getByText("Model a")).toBeTruthy();
    expect(within(rows[1]).getByText("Claude")).toBeTruthy();
    expect(within(rows[1]).getByText("36%")).toBeTruthy();
    expect(within(rows[5]).getByText("Model e")).toBeTruthy();
    expect(within(rows[5]).getByText("$2.00")).toBeTruthy();
    expect(screen.queryByText("Model f")).toBeNull();
  });

  it("marks the CLI column and the share bar as what narrow screens drop", () => {
    const { container } = render(<ModelList breakdown={breakdown} />);
    const minor = [...container.querySelectorAll("[data-minor]")];
    expect(minor.filter((el) => el.matches("th, td")).map((el) => el.textContent)).toEqual(["CLI", "Claude", "Claude", "Claude", "Claude", "Codex"]);
    expect(minor.filter((el) => el.matches('[data-vu1="meter"]'))).toHaveLength(5);
  });
});

describe("RankScreen", () => {
  it("marks my row in red where it falls", () => {
    render(<RankScreen entries={ENTRIES} me={{ ...ENTRIES[2] }} handle="ada" />);
    const rows = within(screen.getByRole("table", { name: "Rankings" })).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(rows[3]).toHaveAttribute("data-me", "true");
    expect(within(rows[1]).getByText("Claude")).toBeTruthy();
    expect(within(rows[2]).getByText("GPT")).toBeTruthy();
  });

  it("explains the Load column in a tooltip on its header", async () => {
    render(<RankScreen entries={ENTRIES} me={null} handle="ada" />);
    act(() => screen.getByText("Load").focus());
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Tokens relative to the highest total on this page.");
  });

  it("pins my row on top when I am off this page", () => {
    render(<RankScreen entries={ENTRIES.slice(0, 2)} me={{ ...ENTRIES[2], rank: 120, is_me: true }} handle="ada" />);
    const rows = within(screen.getByRole("table", { name: "Rankings" })).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveAttribute("data-me", "true");
    expect(within(rows[1]).getByText("120")).toBeTruthy();
  });

  it("marks only the top CLI column as what narrow screens drop", () => {
    const { container } = render(<RankScreen entries={ENTRIES} me={null} handle="ada" />);
    const minor = [...container.querySelectorAll("[data-minor]")];
    expect(minor.map((el) => el.textContent)).toEqual(["Top CLI", "Claude", "GPT", "Other"]);
  });
});

describe("RankScreen without channel counts", () => {
  it("shows a placeholder for the top CLI", () => {
    render(<RankScreen entries={[{ rank: 1, display_name: "solo", total_tokens: 10 }]} me={null} handle="ada" />);
    const rows = within(screen.getByRole("table", { name: "Rankings" })).getAllByRole("row");
    expect(within(rows[1]).getAllByText("--")).toHaveLength(1);
  });
});

describe("MyRankLcd", () => {
  it("shows my rank and the gap to the next rank up", () => {
    render(<MyRankLcd me={{ ...ENTRIES[2] }} entries={ENTRIES} />);
    expect(screen.getByText("#37")).toBeTruthy();
    expect(screen.getByText("Gap to #36")).toBeTruthy();
    expect(screen.getByText("1.2M")).toBeTruthy();
  });

  it("shows a placeholder when I am unranked", () => {
    render(<MyRankLcd me={null} entries={ENTRIES} />);
    expect(screen.getByText("--")).toBeTruthy();
    expect(screen.queryByText(/Gap to/)).toBeNull();
  });
});

describe("Pager", () => {
  it("moves between pages by link, previous and next", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pager page={3} pageCount={392} onPageChange={onPageChange} />);
    expect(screen.getByRole("button", { name: "3" })).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("button", { name: "4" }));
    expect(onPageChange).toHaveBeenLastCalledWith(4);
    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    screen.getByRole("button", { name: "Next page" }).focus();
    await user.keyboard("{Enter}");
    expect(onPageChange).toHaveBeenLastCalledWith(4);
  });

  it("names the arrow keys in a tooltip", async () => {
    const user = userEvent.setup();
    render(<Pager page={3} pageCount={392} onPageChange={() => {}} />);
    await user.hover(screen.getByRole("button", { name: "Previous page" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Previous page");
    await user.unhover(screen.getByRole("button", { name: "Previous page" }));
    await user.hover(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByRole("tooltip", { name: "Next page" })).toBeTruthy();
  });
});

describe("InstallCommand", () => {
  it("copies the command from its key", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<InstallCommand command="npx --yes vibeusage init" />);
    expect(screen.getByText("npx --yes vibeusage init")).toBeTruthy();
    await user.tab();
    await user.keyboard("{Enter}");
    expect(writeText).toHaveBeenCalledWith("npx --yes vibeusage init");
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
  });
});

describe("Keys", () => {
  it("presses Share and Install from the keyboard", async () => {
    const onShare = vi.fn();
    const onInstall = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <ShareKey onPress={onShare} />
        <InstallKey onPress={onInstall} />
      </>,
    );
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Share screenshot" }));
    await user.keyboard("{Enter}");
    expect(onShare).toHaveBeenCalledTimes(1);
    await user.tab();
    await user.keyboard(" ");
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it("holds Share while a capture runs", async () => {
    const onShare = vi.fn();
    render(<ShareKey onPress={onShare} busy />);
    fireEvent.click(screen.getByRole("button", { name: "Share screenshot" }));
    expect(onShare).not.toHaveBeenCalled();
  });
});

describe("UpgradeToast", () => {
  it("names the version and stays dismissed after Update", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const { unmount } = render(<UpgradeToast requiredVersion="0.9.2" onUpdate={onUpdate} />);
    expect(screen.getByRole("status")).toHaveTextContent("CLI 0.9.2 available");
    await user.click(screen.getByRole("button", { name: "Copy update command" }));
    expect(onUpdate).toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
    unmount();
    render(<UpgradeToast requiredVersion="0.9.2" />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("still names a new version after the versionless note was dismissed", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<UpgradeToast requiredVersion={null} />);
    await user.click(screen.getByRole("button", { name: "Copy update command" }));
    unmount();
    render(<UpgradeToast requiredVersion="0.9.3" />);
    expect(screen.getByRole("status")).toHaveTextContent("CLI 0.9.3 available");
  });
});

describe("StateScreen", () => {
  const view = (variant: StateVariant, on: { onRetry?: () => void; onSignIn?: () => void } = {}) => <StateScreen variant={variant} {...on} />;

  it("renders each state with its copy", async () => {
    const onRetry = vi.fn();
    const onSignIn = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(view("loading"));
    expect(screen.getByRole("region")).toHaveAttribute("aria-busy", "true");
    rerender(view("empty"));
    expect(screen.getByText("Waiting for first sync")).toBeTruthy();
    rerender(view("error", { onRetry }));
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
    rerender(view("no-entries"));
    expect(screen.getByRole("region", { name: "No entries for this period." })).toBeTruthy();
    expect(screen.queryByText(/sync/i)).toBeNull();
    rerender(view("signed-out", { onSignIn }));
    expect(screen.getByRole("region")).toHaveTextContent(/^Sign in with GitHub to view your usage and rank\.Sign in$/);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onSignIn).toHaveBeenCalled();
  });
});

describe("TopBar", () => {
  afterEach(() => setSoundEnabled(false));

  it("marks the current page, opens GitHub in a new tab and toggles key sounds", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();
    render(
      <TopBar
        active="dashboard"
        signedIn
        hrefs={{ home: "/", dashboard: "/dashboard", leaderboard: "/leaderboard" }}
        githubHref="https://github.com/victorGPT/vibeusage"
        stars={130}
        onSignOut={onSignOut}
      />,
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
    const github = screen.getByRole("link", { name: /GitHub/ });
    expect(github).toHaveAttribute("target", "_blank");
    expect(github).toHaveTextContent("130");
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalled();
    const sound = screen.getByRole("button", { name: "Key sounds" });
    expect(sound).toHaveAttribute("aria-pressed", "false");
    sound.focus();
    await user.keyboard("{Enter}");
    expect(sound).toHaveAttribute("aria-pressed", "true");
  });

  it("names the sound key in a tooltip", async () => {
    render(<TopBar active={null} signedIn={false} hrefs={{ home: "/", dashboard: "/d", leaderboard: "/l" }} githubHref="#" stars={null} />);
    screen.getByRole("button", { name: "Key sounds" }).focus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Key sounds");
  });

  it("prints the brand without the VU-1 model", () => {
    const { container } = render(<TopBar active={null} signedIn={false} hrefs={{ home: "/", dashboard: "/d", leaderboard: "/l" }} githubHref="#" stars={null} />);
    expect(container.textContent).toContain("VIBEUSAGE");
    expect(container.textContent).not.toContain("VU-1");
  });

  it("offers Sign in when signed out, as a plain key so the page keeps its one red key", () => {
    render(<TopBar active={null} signedIn={false} hrefs={{ home: "/", dashboard: "/d", leaderboard: "/l" }} githubHref="#" stars={null} />);
    expect(screen.getByRole("button", { name: "Sign in" })).not.toHaveAttribute("data-tone", "primary");
    expect(screen.getByRole("link", { name: /GitHub/ })).not.toHaveTextContent("★");
  });
});
