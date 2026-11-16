import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import App from "./App.jsx";
import { copy } from "./lib/copy";

const crash = vi.hoisted(() => ({ on: false }));

vi.mock("./lib/npm-version", () => ({ fetchLatestTrackerVersion: async () => null }));
vi.mock("./pages/DashboardPage.jsx", () => ({
  DashboardPage: ({ publicMode, publicToken }) => {
    if (crash.on) throw new Error("dashboard boom");
    return <p>{`dashboard · public=${publicMode} · token=${publicToken}`}</p>;
  },
}));
vi.mock("./pages/LeaderboardPage.jsx", () => ({
  LeaderboardPage: () => {
    if (crash.on) throw new Error("leaderboard boom");
    return null;
  },
}));
vi.mock("./pages/AgentResourcePage.jsx", () => ({
  AgentResourcePage: () => {
    if (crash.on) throw new Error("developers boom");
    return null;
  },
}));

function renderAt(path) {
  window.history.pushState({}, "", path);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  };
  globalThis.CSS ??= {};
  CSS.supports ??= () => false;
});

afterEach(() => {
  crash.on = false;
  vi.restoreAllMocks();
});

describe("App routes", () => {
  it("opens /share/<token> as the public dashboard view with that token", async () => {
    renderAt("/share/pv1-abc");
    expect(await screen.findByText("dashboard · public=true · token=pv1-abc")).toBeTruthy();
  });

  it.each([
    ["/?mock=1", "dashboard boom"],
    ["/leaderboard?mock=1", "leaderboard boom"],
    ["/share/pv1-abc", "dashboard boom"],
    ["/developers", "developers boom"],
  ])("shows the VU-1 crash screen when %s throws", async (path, message) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    crash.on = true;
    renderAt(path);
    expect(await screen.findByRole("region", { name: copy("vu1.state.crash_title") })).toBeTruthy();
    expect(screen.getByText(copy("shared.error.prefix", { error: message }))).toBeTruthy();
  });
});
