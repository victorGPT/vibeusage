import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { copy } from "../../lib/copy";
import { LandingPage } from "../LandingPage.jsx";

const SIGN_UP = "/sign-up?next=%2Fleaderboard";

// jsdom has no ResizeObserver or CSS.supports; the kit's Device refits its zoom with the first and
// probes caret support with the second.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  };
  globalThis.CSS ??= {};
  CSS.supports ??= () => false;
});

afterEach(() => vi.restoreAllMocks());

describe("LandingPage", () => {
  it("sends every Sign in entry to the same auth URL", async () => {
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign });
    render(<LandingPage signInUrl="/sign-in" signUpUrl={SIGN_UP} />);

    expect(screen.getByRole("link", { name: copy("vu1.landing.sign_in") }).getAttribute("href")).toBe(SIGN_UP);

    await userEvent.click(screen.getByRole("button", { name: copy("vu1.top.sign_in") }));
    expect(assign).toHaveBeenCalledWith(SIGN_UP);
  });

  it("links the leaderboard from the hero and marks Home as the current page", () => {
    render(<LandingPage signInUrl="/sign-in" signUpUrl={SIGN_UP} />);
    const hero = screen.getByRole("main");
    expect(within(hero).getByRole("link", { name: copy("vu1.landing.leaderboard") }).getAttribute("href")).toBe("/leaderboard");
    const nav = screen.getByRole("navigation", { name: copy("vu1.top.nav_aria") });
    expect(within(nav).getByRole("link", { name: copy("vu1.top.home") }).getAttribute("aria-current")).toBe("page");
  });

  it("opens the GitHub repo in a new tab and says so", () => {
    render(<LandingPage signInUrl="/sign-in" signUpUrl={SIGN_UP} />);
    const github = screen.getByRole("link", { name: /GitHub.*new tab/i });
    expect(github.getAttribute("href")).toBe("https://github.com/victorGPT/vibeusage");
    expect(github.getAttribute("target")).toBe("_blank");
    expect(github.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("shows the install command with a copy key", () => {
    render(<LandingPage signInUrl="/sign-in" signUpUrl={SIGN_UP} />);
    expect(screen.getByText(copy("landing.install.command"))).toBeTruthy();
    expect(screen.getByRole("button", { name: copy("vu1.install.copy") })).toBeTruthy();
  });

  it("labels the global meter as example data on its plate", () => {
    render(<LandingPage signInUrl="/sign-in" signUpUrl={SIGN_UP} />);
    const device = screen.getByRole("region", { name: copy("vu1.landing.meter_name") });
    expect(copy("vu1.landing.meter_name")).toMatch(/example data/i);
    expect(within(device).getByRole("region", { name: copy("vu1.landing.meter_aria") })).toBeTruthy();
  });

  it("says what is read and what is uploaded in the hero, without a spec section", () => {
    render(<LandingPage signInUrl="/sign-in" signUpUrl={SIGN_UP} />);
    expect(screen.getByText(copy("vu1.landing.body"))).toHaveTextContent(/Only half-hour token totals are uploaded/);
    expect(screen.queryAllByRole("heading", { level: 3 })).toEqual([]);
  });

  it("keeps one product summary as visible body text for crawlers", () => {
    render(<LandingPage signInUrl="/sign-in" signUpUrl={SIGN_UP} />);
    for (const key of ["landing.seo.title", "landing.seo.summary"]) {
      const el = screen.getByText(copy(key));
      for (let node = el; node; node = node.parentElement) {
        expect(node.hidden, key).toBe(false);
        expect(node.getAttribute("aria-hidden"), key).not.toBe("true");
        expect(node.className, key).not.toMatch(/\b(sr-only|hidden|invisible)\b/);
      }
    }
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([copy("landing.seo.title")]);
    expect(within(screen.getByRole("main")).queryAllByRole("list").filter((l) => !l.closest("[aria-label]"))).toEqual([]);
  });

  it("names the product without the VU-1 model and keeps the hero keys to one or two words", () => {
    const { container } = render(<LandingPage signInUrl="/sign-in" signUpUrl={SIGN_UP} />);
    expect(container.textContent).not.toContain("VU-1");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("VIBEUSAGE");
    const hero = screen.getByRole("main");
    expect(within(hero).getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe(SIGN_UP);
    expect(within(hero).getByRole("link", { name: "Leaderboard" }).getAttribute("href")).toBe("/leaderboard");
  });

  it("opens on the product name with no line above it", () => {
    render(<LandingPage signInUrl="/sign-in" signUpUrl={SIGN_UP} />);
    expect(screen.queryByText("Token usage tracker for AI coding CLIs")).toBeNull();
  });

  it("never renders a raw copy key", () => {
    const { container } = render(<LandingPage signInUrl="/sign-in" signUpUrl={SIGN_UP} />);
    expect(container.textContent).not.toMatch(/\b(vu1|landing|dashboard|leaderboard)\.[a-z_]+/);
  });
});
