import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import App from "./App.jsx";

vi.mock("./lib/npm-version", () => ({ fetchLatestTrackerVersion: async () => null }));

function Where() {
  const location = useLocation();
  return <output aria-label="path">{location.pathname}</output>;
}

describe("App", () => {
  it.each(["/leaderboard/u/abc", "/leaderboard/u/00000000-0000-0000-0000-000000000001/"])(
    "sends the removed public profile %s to /leaderboard",
    async (path) => {
      render(
        <MemoryRouter initialEntries={[`${path}?mock=1`]}>
          <App />
          <Where />
        </MemoryRouter>,
      );
      await waitFor(() => expect(screen.getByRole("status", { name: "path" })).toHaveTextContent(/^\/leaderboard$/));    },
  );
});
