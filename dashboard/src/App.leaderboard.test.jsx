import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App.jsx";

vi.mock("./lib/npm-version", () => ({ fetchLatestTrackerVersion: async () => "9.9.9" }));
vi.mock("./pages/LeaderboardPage.jsx", () => ({
  LeaderboardPage: ({ latestVersion }) => <p>{`leaderboard page · ${latestVersion ?? "none"}`}</p>,
}));

function Where() {
  const location = useLocation();
  return <output aria-label="path">{location.pathname + location.search}</output>;
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Where />
    </MemoryRouter>,
  );
}

// isMockEnabled reads the window's query, not the router's.
beforeEach(() => window.history.pushState({}, "", "/?mock=1"));

describe("App", () => {
  it.each(["/leaderboard/u/abc", "/leaderboard/u/00000000-0000-0000-0000-000000000001/"])(
    "sends the removed public profile %s to /leaderboard",
    async (path) => {
      renderAt(`${path}?period=month`);
      await waitFor(() => expect(screen.getByRole("status", { name: "path" })).toHaveTextContent(/^\/leaderboard\?period=month$/));
    },
  );

  it("hands the latest CLI version to the VU-1 leaderboard instead of drawing the 2049 banner over it", async () => {
    renderAt("/leaderboard?mock=1");
    expect(await screen.findByText("leaderboard page · 9.9.9")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Update available" })).toBeNull();
  });
});
