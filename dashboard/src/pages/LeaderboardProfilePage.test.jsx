import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LeaderboardProfilePage } from "./LeaderboardProfilePage.jsx";

const api = vi.hoisted(() => ({ getLeaderboardProfile: vi.fn() }));
vi.mock("../lib/vibeusage-api", async (importOriginal) => ({
  ...(await importOriginal()),
  getLeaderboardProfile: api.getLeaderboardProfile,
}));

function renderPage(userId = "u-1") {
  return render(
    <MemoryRouter initialEntries={[`/leaderboard/u/${userId}?mock=1`]}>
      <LeaderboardProfilePage baseUrl="http://x" signedIn userId={userId} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.history.pushState({}, "", "/leaderboard/u/u-1?mock=1");
  api.getLeaderboardProfile.mockReset();
});

describe("LeaderboardProfilePage", () => {
  it("shows the visitor's rank and token split read only", async () => {
    api.getLeaderboardProfile.mockResolvedValue({
      period: "week",
      from: "2026-11-06",
      to: "2026-11-12",
      entry: { rank: 7, display_name: "nullbyte", total_tokens: "195900000", gpt_tokens: "117500000", claude_tokens: "58800000", other_tokens: "19600000" },
    });
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "nullbyte" })).toBeTruthy();
    expect(screen.getByText("Public profile · read only")).toBeTruthy();
    expect(screen.getByText("#7")).toBeTruthy();
    expect(screen.getByText("195.9M")).toBeTruthy();
    expect(screen.getByText("117.5M")).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it("shows the broken link screen for an unknown profile", async () => {
    api.getLeaderboardProfile.mockRejectedValue(Object.assign(new Error("Not found"), { status: 404 }));
    renderPage("nope");
    expect(await screen.findByText("This profile is private or the link is wrong.")).toBeTruthy();
  });

  it("shows the broken link screen when the profile has no entry", async () => {
    api.getLeaderboardProfile.mockResolvedValue({ period: "week", from: "2026-11-06", to: "2026-11-12", entry: null });
    renderPage("nope");
    expect(await screen.findByText("This profile is private or the link is wrong.")).toBeTruthy();
    expect(screen.queryByText(/2026-11-06/)).toBeNull();
  });

  it("offers a retry when the service fails", async () => {
    api.getLeaderboardProfile.mockRejectedValue(Object.assign(new Error("boom"), { status: 503 }));
    renderPage();
    expect(await screen.findByRole("button", { name: "Retry" })).toBeTruthy();
  });
});
