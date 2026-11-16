import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { copy } from "../../lib/copy";
import { LandingPage } from "../LandingPage.jsx";

const SIGN_UP = "/sign-up?next=%2Fleaderboard";

// jsdom has no ResizeObserver or CSS.supports; the kit's Device refits its zoom with the first and
// <Hardware> probes caret support with the second.
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
    expect(screen.getByRole("link", { name: copy("vu1.landing.leaderboard") }).getAttribute("href")).toBe("/leaderboard");
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

  it("labels the global meter as example figures", () => {
    render(<LandingPage signInUrl="/sign-in" signUpUrl={SIGN_UP} />);
    const device = screen.getByRole("region", { name: copy("vu1.landing.meter_name") });
    expect(within(device).getByRole("region", { name: copy("vu1.landing.meter_aria") })).toBeTruthy();
    expect(within(device).getByText(copy("vu1.landing.meter_note"))).toBeTruthy();
  });

  it("states the three specs as headings with their bodies", () => {
    render(<LandingPage signInUrl="/sign-in" signUpUrl={SIGN_UP} />);
    for (const n of [1, 2, 3]) {
      expect(screen.getByRole("heading", { level: 3, name: copy(`vu1.landing.spec${n}_title`) })).toBeTruthy();
      expect(screen.getByText(copy(`vu1.landing.spec${n}_body`))).toBeTruthy();
    }
  });

  it("renders inside the hardware skin", () => {
    const { container } = render(<LandingPage signInUrl="/sign-in" signUpUrl={SIGN_UP} />);
    expect(container.firstElementChild.getAttribute("data-skin")).toBe("hardware");
    expect(screen.getByRole("heading", { level: 1, name: copy("vu1.landing.title") })).toBeTruthy();
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
    expect(container.textContent).not.toMatch(/\b(vu1|ui2049|landing|dashboard|leaderboard)\.[a-z_]+/);
  });
});
