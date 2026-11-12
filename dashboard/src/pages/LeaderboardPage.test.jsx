import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getMockLeaderboard } from "../lib/mock-data";
import { LeaderboardPage } from "./LeaderboardPage.jsx";

const api = vi.hoisted(() => ({ getLeaderboard: vi.fn() }));
vi.mock("../lib/github-repo-meta", () => ({ fetchGithubRepoMeta: async () => ({ stars: 57, avatarUrl: null }) }));
vi.mock("../lib/vibeusage-api", async (importOriginal) => ({
  ...(await importOriginal()),
  getLeaderboard: api.getLeaderboard,
}));

const ME = getMockLeaderboard({ period: "week" }).me;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/leaderboard?mock=1"]}>
      <LeaderboardPage baseUrl="http://x" signedIn currentIdentity={{ displayName: "victor" }} />
    </MemoryRouter>,
  );
}

const regionNames = () => screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
const region = (name) => screen.getByRole("region", { name });
const table = () => region(/^All users/);

beforeEach(() => {
  window.history.pushState({}, "", "/leaderboard?mock=1");
  api.getLeaderboard.mockImplementation(async (args) => getMockLeaderboard(args));
});

afterEach(() => {
  api.getLeaderboard.mockReset();
});

describe("LeaderboardPage", () => {
  it("shows MyRank and Top 10 side by side, then the full table", async () => {
    renderPage();
    await screen.findByRole("region", { name: /^All users · Week · 250 ranked$/ });
    expect(regionNames()).toEqual(["My rank · Week · all models", "Top 10 · Week", "All users · Week · 250 ranked", "Ranking rows"]);
    expect(screen.getByRole("heading", { level: 1, name: "LEADERBOARD" })).toBeTruthy();
  });

  it("shows the app version in the page footer", async () => {
    vi.stubEnv("VITE_APP_VERSION", "0.7.1");
    renderPage();
    expect(await screen.findByText("v0.7.1")).toBeTruthy();
    vi.unstubAllEnvs();
  });

  it("shows the repo's GitHub stars in the top nav", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: /^GitHub ★ 57/ })).toBeTruthy();
  });

  it("says when the board was last refreshed", async () => {
    api.getLeaderboard.mockImplementation(async (args) => ({
      ...getMockLeaderboard(args),
      from: "2026-11-06",
      to: "2026-11-12",
      generated_at: new Date(Date.now() - 4 * 60_000).toISOString(),
    }));
    renderPage();
    expect(await screen.findByText("2026-11-06 → 11-12 · updated 4 min ago")).toBeTruthy();
  });

  it("shows three neighbours on each side of my rank", async () => {
    renderPage();
    const myRank = await screen.findByRole("region", { name: /^My rank/ });
    await waitFor(() => expect(within(myRank).getByText(`#${ME.rank - 3}`)).toBeTruthy());
    expect(within(myRank).getByText(`#${ME.rank + 3}`)).toBeTruthy();
    expect(within(myRank).getByText("victor · you")).toBeTruthy();
  });

  it("pins my row under the table from page 2 on and keeps Top 10 on the leaders", async () => {
    renderPage();
    await screen.findByText("Page 1 of 13");
    fireEvent.click(within(table()).getByRole("button", { name: "2" }));
    await screen.findByText("Page 2 of 13");
    await waitFor(() => expect(within(table()).getByText("#21")).toBeTruthy());
    const pinned = table().querySelector("tfoot");
    expect(within(pinned).getByText("victor · you")).toBeTruthy();
    expect(within(pinned).getByText(`#${ME.rank}`)).toBeTruthy();
    expect(within(region(/^Top 10/)).getByText("#1")).toBeTruthy();
    expect(within(region(/^Top 10/)).queryByText("#21")).toBeNull();
  });

  it("jumps to the page that holds my row", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: `Jump to me · #${ME.rank}` }));
    const myPage = Math.ceil(ME.rank / 20);
    await screen.findByText(`Page ${myPage} of 13`);
    await waitFor(() => expect(table().querySelector("tbody").textContent).toContain("victor · you"));
    expect(table().querySelector("tfoot")).toBeNull();
  });

  it("refetches every block for the chosen metric and names it in MyRank", async () => {
    renderPage();
    await screen.findByText("Page 1 of 13");
    api.getLeaderboard.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "GPT" }));
    await screen.findByRole("region", { name: "My rank · Week · GPT" });
    await waitFor(() => expect(api.getLeaderboard).toHaveBeenCalledWith(expect.objectContaining({ offset: 0, limit: 20, metric: "gpt" })));
    expect(api.getLeaderboard.mock.calls.every(([args]) => args.metric === "gpt")).toBe(true);
  });

  it("refetches every block for the chosen period", async () => {
    renderPage();
    await screen.findByText("Page 1 of 13");
    api.getLeaderboard.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    await screen.findByRole("region", { name: /^All users · Month/ });
    await waitFor(() => expect(api.getLeaderboard.mock.calls.length).toBeGreaterThanOrEqual(3));
    expect(api.getLeaderboard.mock.calls.every(([args]) => args.period === "month")).toBe(true);
  });

  it("finds my row and neighbours when tied ranks push me past my rank's page", async () => {
    // dense_rank: ranks 1..60 each held by two rows, so rank r sits at rows 2r-1 and 2r.
    const rows = Array.from({ length: 120 }, (_, i) => ({
      rank: Math.floor(i / 2) + 1,
      user_id: `u${i}`,
      is_public: true,
      is_me: i === 79,
      display_name: `n${i}`,
      total_tokens: String(10_000 - i),
    }));
    const me = { rank: 40, total_tokens: rows[79].total_tokens };
    api.getLeaderboard.mockImplementation(async ({ offset = 0, limit = 20 }) => ({
      period: "week",
      from: "2026-11-06",
      to: "2026-11-12",
      page: Math.floor(offset / limit) + 1,
      total_pages: 6,
      total_entries: 120,
      entries: rows.slice(offset, offset + limit),
      me,
    }));
    renderPage();
    const myRank = await screen.findByRole("region", { name: /^My rank/ });
    await waitFor(() => expect(within(myRank).getAllByText("#39")).toHaveLength(2));
    expect(within(myRank).getByText("#42")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Jump to me · #40" }));
    await screen.findByText("Page 4 of 6");
    await waitFor(() => expect(table().querySelector("tbody").textContent).toContain("victor · you"));
  });

  it("shows the empty screen, not an empty table or made-up ranks, when nobody is ranked", async () => {
    api.getLeaderboard.mockResolvedValue({
      period: "week",
      from: "2026-11-08",
      to: "2026-11-14",
      page: 1,
      total_pages: 0,
      total_entries: 0,
      entries: [],
      me: { rank: null, total_tokens: "0" },
    });
    renderPage();
    const empty = await screen.findByRole("region", { name: "All users · Week · 0 ranked" });
    expect(within(empty).getByText(/Run any AI CLI/)).toBeTruthy();
    expect(regionNames()).toEqual(["All users · Week · 0 ranked"]);
    expect(screen.queryByText(/Page 1 of 0/)).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("offers a retry when the board fails to load", async () => {
    api.getLeaderboard.mockRejectedValue(new Error("boom"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await waitFor(() => expect(api.getLeaderboard.mock.calls.length).toBeGreaterThan(1));
  });
});
