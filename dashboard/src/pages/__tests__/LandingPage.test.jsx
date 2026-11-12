import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LandingPage } from "../LandingPage.jsx";

const SIGN_UP = "/sign-up?next=%2Fleaderboard";

afterEach(() => vi.restoreAllMocks());

describe("LandingPage", () => {
  it("sends every Sign in entry to the same auth URL", async () => {
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign });
    render(<LandingPage signInUrl="/sign-in" signUpUrl={SIGN_UP} />);

    const links = screen.getAllByRole("button", { name: "Sign in with GitHub" });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link.getAttribute("href")).toBe(SIGN_UP);

    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(assign).toHaveBeenCalledWith(SIGN_UP);
  });

  it("opens the GitHub repo in a new tab and says so", () => {
    render(<LandingPage signInUrl="/sign-in" signUpUrl={SIGN_UP} />);
    const github = screen.getByRole("button", { name: /GitHub.*new tab/i });
    expect(github.getAttribute("href")).toBe("https://github.com/victorGPT/vibeusage");
    expect(github.getAttribute("target")).toBe("_blank");
    expect(github.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("shows the sample account with three ranked rows and the agent guide link", () => {
    render(<LandingPage signInUrl="/sign-in" signUpUrl={SIGN_UP} />);
    const sample = screen.getByRole("region", { name: /Sample account/i });
    expect(within(sample).getByText("#1")).toBeTruthy();
    expect(within(sample).getByText("#3")).toBeTruthy();
    expect(within(sample).queryByText("#4")).toBeNull();
    expect(within(sample).getByText("nullbyte")).toBeTruthy();
    expect(screen.getByText("https://github.com/victorGPT/vibeusage/blob/main/docs/AI_AGENT_INSTALL.md")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "See where you rank this week." })).toBeTruthy();
  });

  it("never renders a raw copy key", () => {
    const { container } = render(<LandingPage signInUrl="/sign-in" signUpUrl={SIGN_UP} />);
    expect(container.textContent).not.toMatch(/\b(ui2049|landing|dashboard|leaderboard)\.[a-z_]+/);
  });
});
