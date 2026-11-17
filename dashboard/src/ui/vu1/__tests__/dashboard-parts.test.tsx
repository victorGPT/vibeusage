import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DASHBOARD_SOURCES, sourceSlice } from "../derive";
import { IdentityStrip } from "../IdentityStrip";
import { StateScreen } from "../StateScreen";
import { TopBar } from "../TopBar";
import type { ModelBreakdown } from "../types";

const BREAKDOWN: ModelBreakdown = {
  sources: [
    { source: "claude", totals: { total_tokens: 600, billable_total_tokens: 500, total_cost_usd: 6 }, models: [{ model_id: "opus", totals: { total_tokens: 600 } }] },
    { source: "codex", totals: { total_tokens: 300, billable_total_tokens: 300, total_cost_usd: 3 }, models: [{ model_id: "gpt", totals: { total_tokens: 300 } }] },
    { source: "every-code", totals: { total_tokens: 70, billable_total_tokens: 70, total_cost_usd: "0.7" }, models: [] },
    { source: "kimi", totals: { total_tokens: 30, billable_total_tokens: 30, total_cost_usd: 0.3 }, models: [] },
  ],
};

describe("sourceSlice", () => {
  it("lists the five dashboard sources in the mock's order", () => {
    expect(DASHBOARD_SOURCES).toEqual(["all", "claude", "codex", "gemini", "other"]);
  });

  it("leaves All to the summary and keeps every model", () => {
    expect(sourceSlice(BREAKDOWN, "all")).toEqual({ totals: null, breakdown: BREAKDOWN });
  });

  it("reads a named source from its own totals and models", () => {
    const slice = sourceSlice(BREAKDOWN, "codex");
    expect(slice.totals).toEqual({ total_tokens: 300, billable_total_tokens: 300, total_cost_usd: 3 });
    expect(slice.breakdown.sources?.map((s) => s.source)).toEqual(["codex"]);
  });

  it("sums every source outside Claude, Codex and Gemini into Other", () => {
    const slice = sourceSlice(BREAKDOWN, "other");
    expect(slice.totals).toEqual({ total_tokens: 100, billable_total_tokens: 100, total_cost_usd: 1 });
    expect(slice.breakdown.sources?.map((s) => s.source)).toEqual(["every-code", "kimi"]);
  });

  it("reads zero for a source with no usage and nothing while the breakdown loads", () => {
    expect(sourceSlice(BREAKDOWN, "gemini").totals).toEqual({ total_tokens: 0, billable_total_tokens: 0, total_cost_usd: 0 });
    expect(sourceSlice(null, "claude")).toEqual({ totals: null, breakdown: {} });
  });
});

describe("StateScreen, dashboard variants", () => {
  it("shows the install command with the link code inside the screen", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<StateScreen variant="install" linkCode="abc123" />);
    expect(screen.getByRole("heading", { name: "Install the tracker" })).toBeTruthy();
    expect(screen.getByText("npx --yes vibeusage init --link-code abc123")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("npx --yes vibeusage init --link-code abc123");
  });

  it("falls back to the plain install command without a link code", () => {
    render(<StateScreen variant="install" />);
    expect(screen.getByText("npx --yes vibeusage init")).toBeTruthy();
  });

  it("asks an expired session to sign in again", async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn();
    render(<StateScreen variant="expired" onSignIn={onSignIn} />);
    expect(screen.getByRole("heading", { name: "Session expired." })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(onSignIn).toHaveBeenCalled();
  });

  it("tells a share visitor the link is wrong", () => {
    render(<StateScreen variant="invalid" />);
    expect(screen.getByRole("heading", { name: "This profile is private or the link is invalid." })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("TopBar without the account key", () => {
  it("shows neither Sign in nor Sign out", () => {
    const hrefs = { home: "/", dashboard: "/", leaderboard: "/leaderboard" };
    const { rerender } = render(<TopBar active="dashboard" signedIn account={false} hrefs={hrefs} githubHref="#" stars={null} />);
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    rerender(<TopBar active="dashboard" signedIn={false} account={false} hrefs={hrefs} githubHref="#" stars={null} />);
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
    expect(screen.getByRole("button", { name: "Key sounds" })).toBeTruthy();
  });
});

describe("IdentityStrip", () => {
  it("lets the owner turn the public profile on and copy its link", async () => {
    const user = userEvent.setup();
    const onPublicChange = vi.fn();
    const onCopyShareLink = vi.fn();
    const { rerender } = render(
      <IdentityStrip owner since="2026-01-02" activeDays={12} subscriptions={["Claude Code Max 20x"]} publicEnabled={false} onPublicChange={onPublicChange} onCopyShareLink={onCopyShareLink} />,
    );
    expect(screen.getByText("Since 2026-01-02 · 12 active days")).toBeTruthy();
    expect(screen.getByText("Claude Code Max 20x")).toBeTruthy();
    const toggle = screen.getByRole("switch", { name: "Public profile" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: "Copy share link" })).toBeDisabled();
    await user.click(toggle);
    expect(onPublicChange).toHaveBeenCalledWith(true);
    rerender(<IdentityStrip owner publicEnabled onPublicChange={onPublicChange} onCopyShareLink={onCopyShareLink} shareCopied={false} />);
    expect(screen.getByRole("switch", { name: "Public profile" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("button", { name: "Copy share link" }));
    expect(onCopyShareLink).toHaveBeenCalled();
    rerender(<IdentityStrip owner publicEnabled shareCopied />);
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
  });

  it("holds both keys while a change is in flight", () => {
    render(<IdentityStrip owner publicEnabled publicBusy />);
    expect(screen.getByRole("switch", { name: "Public profile" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copy share link" })).toBeDisabled();
  });

  it("reads as read-only for a share visitor", () => {
    render(<IdentityStrip owner={false} />);
    expect(screen.getByText("Public profile · read only")).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
  });
});
