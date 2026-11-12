import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { copy } from "../../lib/copy";
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

  it("keeps the product summary as visible body text for crawlers", () => {
    render(<LandingPage signInUrl="/sign-in" signUpUrl={SIGN_UP} />);
    const keys = ["title", "summary", "point1", "point2", "point3", "roadmap"].map((k) => `landing.seo.${k}`);
    for (const key of keys) {
      const el = screen.getByText(copy(key));
      for (let node = el; node; node = node.parentElement) {
        expect(node.hidden, key).toBe(false);
        expect(node.getAttribute("aria-hidden"), key).not.toBe("true");
        expect(node.className, key).not.toMatch(/\b(sr-only|hidden|invisible)\b/);
      }
    }
    expect(screen.getByRole("heading", { level: 2, name: copy("landing.seo.title") })).toBeTruthy();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(
      expect.arrayContaining(["point1", "point2", "point3"].map((k) => copy(`landing.seo.${k}`))),
    );
  });

  it("never renders a raw copy key", () => {
    const { container } = render(<LandingPage signInUrl="/sign-in" signUpUrl={SIGN_UP} />);
    expect(container.textContent).not.toMatch(/\b(ui2049|landing|dashboard|leaderboard)\.[a-z_]+/);
  });
});
