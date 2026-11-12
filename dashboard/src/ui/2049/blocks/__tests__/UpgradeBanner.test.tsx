import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { UpgradeBanner } from "../UpgradeBanner";

function show(version: string) {
  return render(<UpgradeBanner requiredVersion={version} />);
}

describe("UpgradeBanner", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) },
    });
  });

  it("names the new version and offers the install command", () => {
    show("0.8.0");
    expect(screen.getByText("VibeUsage Tracker v0.8.0 is now available.")).toBeTruthy();
    expect(screen.getByText("npx --yes vibeusage init")).toBeTruthy();
  });

  it("stays dismissed for that version, and comes back for a newer one", async () => {
    const { unmount } = show("0.8.0");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Update available")).toBeNull();
    unmount();
    show("0.8.0");
    expect(screen.queryByText("Update available")).toBeNull();
    show("0.9.0");
    expect(screen.getByText("Update available")).toBeTruthy();
  });

  it("sits in the page flow so it never covers the top navigation", () => {
    show("0.8.0");
    const banner = screen.getByRole("region", { name: "Update available" });
    expect(banner.className).not.toMatch(/\b(fixed|absolute|sticky)\b/);
  });
});
