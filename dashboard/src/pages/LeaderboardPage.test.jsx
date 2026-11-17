import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LeaderboardPage } from "./LeaderboardPage.jsx";

const api = vi.hoisted(() => ({ getLeaderboard: vi.fn() }));
vi.mock("../lib/github-repo-meta", () => ({ fetchGithubRepoMeta: async () => ({ stars: 57, avatarUrl: null }) }));
vi.mock("../lib/vibeusage-api", async (importOriginal) => ({
  ...(await importOriginal()),
  getLeaderboard: api.getLeaderboard,
}));

// 100 ranked users, ten to a page; I am rank 25, so my row lives on page 3.
const ROWS = Array.from({ length: 100 }, (_, i) => ({
  rank: i + 1,
  user_id: `u${i}`,
  is_me: i === 24,
  display_name: `n${i}`,
  total_tokens: String(1_000_000 - i * 1_000),
  gpt_tokens: String(600_000 - i * 600),
  claude_tokens: "0",
  other_tokens: "0",
}));
const ME = { rank: 25, total_tokens: ROWS[24].total_tokens, gpt_tokens: ROWS[24].gpt_tokens };

function serve(rows, me) {
  api.getLeaderboard.mockImplementation(async ({ period = "week", offset = 0, limit = 10 }) => ({
    period,
    from: "2026-11-10",
    to: "2026-11-16",
    page: Math.floor(offset / limit) + 1,
    total_pages: Math.ceil(rows.length / limit),
    total_entries: rows.length,
    entries: rows.slice(offset, offset + limit),
    me,
  }));
}

function renderPage(path = "/leaderboard") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LeaderboardPage baseUrl="http://x" auth="token" signedIn currentIdentity={{ displayName: "victor" }} />
    </MemoryRouter>,
  );
}

const rankings = () => screen.findByRole("table", { name: "Rankings" });
const bodyRows = (table) => within(table).getAllByRole("row").slice(1);

// jsdom has neither; the Device fits itself with ResizeObserver and the hardware skin probes CSS.supports.
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
vi.stubGlobal("CSS", { ...globalThis.CSS, supports: () => false });

beforeEach(() => serve(ROWS, ME));
afterEach(() => api.getLeaderboard.mockReset());

describe("LeaderboardPage", () => {
  it("marks the device with the product name, not the VU-1 model", async () => {
    const { container } = renderPage();
    await rankings();
    expect(container.textContent).toContain("VIBEUSAGE");
    expect(container.textContent).not.toContain("VU-1");
  });

  it("pins my row in red on top when the page shown does not hold it", async () => {
    renderPage();
    const rows = bodyRows(await rankings());
    expect(rows).toHaveLength(11);
    expect(rows[0]).toHaveAttribute("data-me");
    expect(within(rows[0]).getByText("25")).toBeTruthy();
    expect(within(rows[0]).getByText("victor")).toBeTruthy();
    expect(within(rows[1]).getByText("1")).toBeTruthy();
  });

  it("shows my row in red where it falls on page 3, with no pinned copy", async () => {
    renderPage();
    await rankings();
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    await waitFor(() => expect(within(screen.getByRole("table", { name: "Rankings" })).getByText("21")).toBeTruthy());
    const rows = bodyRows(screen.getByRole("table", { name: "Rankings" }));
    expect(rows).toHaveLength(10);
    const mine = rows.filter((row) => row.hasAttribute("data-me"));
    expect(mine).toHaveLength(1);
    expect(rows.indexOf(mine[0])).toBe(4);
    expect(within(mine[0]).getByText("victor")).toBeTruthy();
    expect(api.getLeaderboard).toHaveBeenCalledWith(expect.objectContaining({ offset: 20, limit: 10 }));
  });

  it("offers Week, Month and Total, and refetches the board from page 1 for the one chosen", async () => {
    renderPage();
    await rankings();
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["Week", "Month", "Total"]);
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    await waitFor(() => expect(api.getLeaderboard).toHaveBeenCalledWith(expect.objectContaining({ offset: 20 })));
    api.getLeaderboard.mockClear();
    fireEvent.click(screen.getByRole("radio", { name: "Month" }));
    await waitFor(() =>
      expect(api.getLeaderboard).toHaveBeenCalledWith(expect.objectContaining({ period: "month", offset: 0, limit: 10 })),
    );
    expect(api.getLeaderboard.mock.calls.every(([args]) => args.period === "month")).toBe(true);
    expect(screen.getByRole("radio", { name: "Month" })).toHaveAttribute("aria-checked", "true");
  });

  it("starts a board on page 1 again after visiting another board", async () => {
    renderPage();
    await rankings();
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    await waitFor(() => expect(api.getLeaderboard).toHaveBeenCalledWith(expect.objectContaining({ period: "week", offset: 20 })));
    fireEvent.click(screen.getByRole("radio", { name: "Month" }));
    await waitFor(() => expect(api.getLeaderboard).toHaveBeenCalledWith(expect.objectContaining({ period: "month", offset: 0 })));
    api.getLeaderboard.mockClear();
    fireEvent.click(screen.getByRole("radio", { name: "Week" }));
    await waitFor(() => expect(api.getLeaderboard).toHaveBeenCalledWith(expect.objectContaining({ period: "week", offset: 0, limit: 10 })));
    expect(api.getLeaderboard).not.toHaveBeenCalledWith(expect.objectContaining({ offset: 20 }));
  });

  it("reads the board from ?period= and ranks every row on all models", async () => {
    renderPage("/leaderboard?period=total");
    await rankings();
    expect(screen.getByRole("radio", { name: "Total" })).toHaveAttribute("aria-checked", "true");
    expect(api.getLeaderboard.mock.calls.every(([args]) => args.period === "total" && args.metric === "all")).toBe(true);
  });

  it("shows my rank and the gap to the rank above in the small screen", async () => {
    renderPage();
    const mine = await screen.findByRole("region", { name: "My rank" });
    await waitFor(() => expect(within(mine).getByText("Gap to #24")).toBeTruthy());
    expect(within(mine).getByText("#25")).toBeTruthy();
    expect(within(mine).getByText("1K")).toBeTruthy();
  });

  it("finds the rank to pass when many rows tie with mine", async () => {
    const rows = [
      { rank: 1, user_id: "top", display_name: "top", total_tokens: "2000" },
      ...Array.from({ length: 14 }, (_, i) => ({ rank: 2, user_id: `t${i}`, is_me: i === 13, display_name: `t${i}`, total_tokens: "1000" })),
    ];
    serve(rows, { rank: 2, total_tokens: "1000" });
    renderPage();
    await rankings();
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    await waitFor(() => expect(within(screen.getByRole("table", { name: "Rankings" })).queryByText("top")).toBeNull());
    const mine = await screen.findByRole("region", { name: "My rank" });
    await waitFor(() => expect(within(mine).getByText("Gap to #1")).toBeTruthy());
    expect(within(mine).getByText("1K")).toBeTruthy();
  });

  it("counts the ranked users on the device plate", async () => {
    renderPage();
    await rankings();
    expect(screen.getByText("100 users")).toBeTruthy();
  });

  it("does not make rows clickable", async () => {
    renderPage();
    const table = await rankings();
    expect(within(table).queryAllByRole("link")).toHaveLength(0);
    expect(within(table).queryAllByRole("button")).toHaveLength(0);
  });

  it("marks Leaderboard as the current page in the top bar", async () => {
    renderPage();
    await rankings();
    expect(screen.getByRole("link", { name: "Leaderboard" })).toHaveAttribute("aria-current", "page");
  });

  it("tells me a newer CLI is out in a toast, and Update copies the upgrade command", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(
      <MemoryRouter initialEntries={["/leaderboard"]}>
        <LeaderboardPage baseUrl="http://x" auth="token" signedIn latestVersion="9.9.9" />
      </MemoryRouter>,
    );
    const toast = (await screen.findByText(/9\.9\.9/)).closest('[role="status"]');
    fireEvent.click(within(toast).getByRole("button", { name: "Update" }));
    expect(writeText).toHaveBeenCalledWith("npx --yes vibeusage init");
  });

  it("shows the empty screen when nobody is ranked", async () => {
    serve([], { rank: null, total_tokens: "0" });
    renderPage();
    expect(await screen.findByRole("region", { name: "Waiting for first sync" })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("offers a retry when the board fails to load", async () => {
    api.getLeaderboard.mockRejectedValue(new Error("boom"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await waitFor(() => expect(api.getLeaderboard.mock.calls.length).toBeGreaterThan(1));
  });
});
