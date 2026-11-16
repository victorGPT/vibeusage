import { act, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { Shell } from "../Shell.jsx";
import { LandingPage } from "../pages/LandingPage.jsx";
import { copy } from "../lib/copy";
import { notify } from "../ui/hardware/toaster";

// jsdom has no ResizeObserver, CSS.supports or getAnimations; the kit's Device, <Hardware> and toasts call them.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  };
  globalThis.CSS ??= {};
  CSS.supports ??= () => false;
  Element.prototype.getAnimations ??= () => [];
});

describe("Shell", () => {
  it("puts every page inside one hardware skin with the VU-1 key color", () => {
    const { container } = render(
      <Shell>
        <LandingPage signInUrl="/sign-in" signUpUrl="/sign-up" />
      </Shell>,
    );
    const skins = container.querySelectorAll('[data-skin="hardware"]');
    expect(skins).toHaveLength(1);
    expect(skins[0].style.getPropertyValue("--theme-h")).toBe("48");
    expect(skins[0].contains(screen.getByRole("heading", { level: 1, name: copy("vu1.landing.title") }))).toBe(true);
  });

  it("shows a toast a page raises", async () => {
    render(<Shell><p>page</p></Shell>);
    await act(async () => {
      notify("Copied");
    });
    expect(await screen.findByText("Copied")).toBeTruthy();
  });
});
