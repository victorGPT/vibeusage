import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { copy } from "#src/lib/copy.ts";

import { ClientList } from "../ClientList";
import { GlobalMeter } from "../GlobalMeter";

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
