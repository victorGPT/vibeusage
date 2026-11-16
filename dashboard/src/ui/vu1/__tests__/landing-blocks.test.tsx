import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { copy } from "#src/lib/copy.ts";

import { ClientList } from "../ClientList";
import { GlobalMeter } from "../GlobalMeter";
import { InstallCommand } from "../InstallCommand";

describe("GlobalMeter", () => {
  const props = { tokens: 8_410_000_000, cost: 21_700, users: 3912, bars: [0.2, 1, 0.5] };

  it("reads tokens, spend and users off the screen", () => {
    render(<GlobalMeter {...props} />);
    const meter = screen.getByRole("region", { name: copy("vu1.landing.meter_aria") });
    const terms = within(meter).getAllByRole("term").map((el) => el.textContent);
    const values = within(meter).getAllByRole("definition").map((el) => el.textContent);
    expect(terms).toEqual([copy("vu1.landing.meter_tokens"), copy("vu1.landing.meter_spend"), copy("vu1.landing.meter_users")]);
    expect(values).toEqual(["8.41B", "$22K", "3,912"]);
  });

  it("draws one bar per value, scaled to the tallest", () => {
    render(<GlobalMeter {...props} />);
    const graph = screen.getByRole("img", { name: copy("vu1.landing.meter_bars_aria") });
    const bars = graph.querySelectorAll('[data-kit="bar-graph-bar"]');
    expect(bars).toHaveLength(3);
    expect([...bars].map((bar) => (bar as HTMLElement).style.getPropertyValue("--v"))).toEqual(["0.2", "1", "0.5"]);
  });

  it("names the window and the scope it reads", () => {
    render(<GlobalMeter {...props} />);
    expect(screen.getByText(copy("vu1.landing.meter_period"))).toBeTruthy();
    expect(screen.getByText(copy("vu1.landing.meter_scope"))).toBeTruthy();
  });
});

describe("ClientList", () => {
  it("lists every supported CLI under one label", () => {
    render(<ClientList />);
    const list = screen.getByRole("list", { name: copy("vu1.landing.clis_aria") });
    const names = within(list).getAllByRole("listitem").map((li) => li.textContent);
    expect(names).toEqual(String(copy("vu1.landing.clis")).split(","));
  });
});

describe("InstallCommand when the clipboard write does not happen", () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  afterEach(() => {
    if (original) Object.defineProperty(navigator, "clipboard", original);
    else delete (navigator as { clipboard?: unknown }).clipboard;
    vi.restoreAllMocks();
  });

  const press = async () => {
    render(<InstallCommand command="npx --yes vibeusage init" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: copy("vu1.install.copy") }));
    });
  };

  it("keeps Copy when there is no clipboard API", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    await press();
    expect(screen.getByRole("button", { name: copy("vu1.install.copy") })).toBeTruthy();
    expect(screen.queryByRole("button", { name: copy("vu1.install.copied") })).toBeNull();
  });

  it("keeps Copy when the write is rejected", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await press();
    expect(writeText).toHaveBeenCalledWith("npx --yes vibeusage init");
    expect(screen.getByRole("button", { name: copy("vu1.install.copy") })).toBeTruthy();
    expect(screen.queryByRole("button", { name: copy("vu1.install.copied") })).toBeNull();
  });
});
