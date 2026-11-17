import React from "react";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { render } from "../test/test-utils.tsx";
import { DashboardPage } from "./DashboardPage.jsx";

const SHARE_LABEL = "Share screenshot";
const INSTALL_LABEL = "Copy install command";

const usageDataHook = vi.hoisted(() => ({
  useUsageData: vi.fn(() => ({
    daily: [],
    summary: { total_tokens: "42", billable_total_tokens: "42" },
    rolling: null,
    source: "edge",
    loading: false,
    refreshing: false,
    error: null,
    refresh: vi.fn(),
  })),
}));

const recentUsageHook = vi.hoisted(() => ({
  useRecentUsageData: vi.fn(() => ({
    rolling: { last_7d: { totals: { billable_total_tokens: "recent" } } },
    source: "edge",
    loading: false,
    error: null,
    refresh: vi.fn(),
  })),
}));

const trendHook = vi.hoisted(() => ({
  useTrendData: vi.fn(() => ({
    rows: [],
    from: "2026-03-01",
    to: "2026-03-07",
    loading: false,
    source: "edge",
    error: null,
    refresh: vi.fn(),
  })),
}));

const heatmapHook = vi.hoisted(() => ({
  useActivityHeatmap: vi.fn(() => ({
    range: { from: "2026-01-01", to: "2026-03-07" },
    daily: [],
    heatmap: { weeks: [], active_days: 1 },
    loading: false,
    source: "edge",
    error: null,
    refresh: vi.fn(),
  })),
}));

const modelBreakdownHook = vi.hoisted(() => ({
  useUsageModelBreakdown: vi.fn(() => ({
    breakdown: null,
    loading: false,
    source: "edge",
    error: null,
    refresh: vi.fn(),
  })),
}));

const projectUsageHook = vi.hoisted(() => ({
  useProjectUsageSummary: vi.fn(() => ({
    entries: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  })),
}));

const authToken = vi.hoisted(() => ({
  isAccessTokenReady: vi.fn(() => true),
  normalizeAccessToken: vi.fn((token) => token),
  resolveAuthAccessToken: vi.fn(async (token) => token ?? null),
}));

const mockData = vi.hoisted(() => ({
  getMockNow: vi.fn(() => null),
  isMockEnabled: vi.fn(() => false),
}));

const timezone = vi.hoisted(() => ({
  formatTimeZoneLabel: vi.fn(() => "UTC+00:00"),
  formatTimeZoneShortLabel: vi.fn(() => "UTC+00:00"),
  getBrowserTimeZone: vi.fn(() => "UTC"),
  getBrowserTimeZoneOffsetMinutes: vi.fn(() => 0),
  getLocalDateParts: vi.fn(() => ({ year: 2026, month: 3, day: 7 })),
  getLocalDayKey: vi.fn(() => "2026-03-07"),
}));

const vibeusageApi = vi.hoisted(() => ({
  getPublicVisibility: vi.fn(async () => ({ enabled: false, share_token: null, updated_at: null })),
  setPublicVisibility: vi.fn(async () => ({ enabled: false, share_token: null, updated_at: null })),
  getUserStatus: vi.fn(async () => ({ subscriptions: { items: [] }, install: null })),
  getPublicViewProfile: vi.fn(async () => ({ profile: null })),
  requestInstallLinkCode: vi.fn(async () => ({ link_code: null, expires_at: null })),
  getLeaderboard: vi.fn(async () => ({ me: null, entries: [], total_entries: 0 })),
}));

const htmlToImage = vi.hoisted(() => ({
  toBlob: vi.fn(async () => new Blob(["image"], { type: "image/png" })),
  toPng: vi.fn(async () => "data:image/png;base64,ZmFrZQ=="),
}));

vi.mock("../hooks/use-usage-data", () => usageDataHook);
vi.mock("../hooks/use-recent-usage-data", () => recentUsageHook);
vi.mock("../hooks/use-trend-data", () => trendHook);
vi.mock("../hooks/use-activity-heatmap", () => heatmapHook);
vi.mock("../hooks/use-usage-model-breakdown", () => modelBreakdownHook);
vi.mock("../hooks/use-project-usage-summary", () => projectUsageHook);
vi.mock("../lib/auth-token", () => authToken);
vi.mock("../lib/mock-data", () => mockData);
vi.mock("../lib/timezone", () => timezone);
vi.mock("../lib/vibeusage-api", () => vibeusageApi);
vi.mock("html-to-image", () => htmlToImage);
// jsdom has no pointer capture, Web Animations, CSS.supports or ResizeObserver; the kit uses them.
beforeAll(() => {
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.getAnimations ??= () => [];
  globalThis.CSS ??= {};
  CSS.supports ??= () => false;
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  modelBreakdownHook.useUsageModelBreakdown.mockReturnValue(breakdown([]));
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  });
});

function renderOwner(props = {}) {
  return render(
    <DashboardPage
      baseUrl="https://example.com"
      auth="token"
      currentIdentity={{ displayName: "Victor" }}
      signedIn
      sessionSoftExpired={false}
      signOut={vi.fn()}
      {...props}
    />,
  );
}

function usage(summary) {
  return {
    daily: [],
    summary,
    rolling: null,
    source: "edge",
    loading: false,
    refreshing: false,
    error: null,
    refresh: vi.fn(),
  };
}

function activity(activeDays) {
  return {
    range: { from: "2026-01-01", to: "2026-03-07" },
    daily: [],
    heatmap: { weeks: [], active_days: activeDays },
    loading: false,
    source: "edge",
    error: null,
    refresh: vi.fn(),
  };
}

function breakdown(sources) {
  return { breakdown: { sources }, loading: false, source: "edge", error: null, refresh: vi.fn() };
}

const readout = (name) => within(screen.getByRole("region", { name: "Screen" })).getByText(name).closest('[data-vu1="read"]');

describe("DashboardPage device controls", () => {
  afterEach(() => {
    vi.clearAllMocks();
    usageDataHook.useUsageData.mockReset();
    heatmapHook.useActivityHeatmap.mockReset();
    modelBreakdownHook.useUsageModelBreakdown.mockReset();
    window.history.replaceState({}, "", "/");
  });

  beforeEach(() => {
    usageDataHook.useUsageData.mockReturnValue(usage({ total_tokens: "42", billable_total_tokens: "42", total_cost_usd: "1.5" }));
    heatmapHook.useActivityHeatmap.mockReturnValue(activity(1));
    modelBreakdownHook.useUsageModelBreakdown.mockReturnValue(
      breakdown([
        { source: "claude", totals: { billable_total_tokens: 1_000_000, total_cost_usd: 5 }, models: [] },
        { source: "codex", totals: { billable_total_tokens: 2_000_000, total_cost_usd: 7 }, models: [] },
      ]),
    );
  });

  it("moves every period-bound hook with the period switch but leaves recent usage unbound", async () => {
    const user = userEvent.setup();
    renderOwner();
    const total = await screen.findByRole("radio", { name: "Total" });
    expect(trendHook.useTrendData.mock.calls.at(-1)?.[0].period).toBe("week");
    await user.click(total);
    await waitFor(() => expect(trendHook.useTrendData.mock.calls.at(-1)?.[0].period).toBe("total"));
    expect(usageDataHook.useUsageData.mock.calls.at(-1)?.[0].includeDaily).toBe(false);
    for (const [args] of recentUsageHook.useRecentUsageData.mock.calls) {
      expect(args).not.toHaveProperty("from");
      expect(args).not.toHaveProperty("to");
      expect(args).not.toHaveProperty("period");
    }
  });

  it("gives Total one slot per month of the window, leading empty months included", async () => {
    const months = Array.from({ length: 24 }, (_, i) => ({
      month: `${2024 + Math.floor((i + 3) / 12)}-${String(((i + 3) % 12) + 1).padStart(2, "0")}`,
      billable_total_tokens: i < 21 ? 0 : 1_000_000,
    }));
    const original = trendHook.useTrendData.getMockImplementation();
    trendHook.useTrendData.mockImplementation(({ period }) => ({ rows: period === "total" ? months : [], loading: false, error: null, refresh: vi.fn() }));
    try {
      const user = userEvent.setup();
      renderOwner();
      await user.click(await screen.findByRole("radio", { name: "Total" }));
      const bars = within(screen.getByRole("region", { name: "Screen" })).getByRole("img", { name: /peak/ });
      await waitFor(() => expect(bars.querySelectorAll('[data-kit="bar-graph-bar"]')).toHaveLength(24));
    } finally {
      trendHook.useTrendData.mockImplementation(original);
    }
  });

  it("reads tokens and cost for the picked source", async () => {
    const user = userEvent.setup();
    renderOwner();
    expect(readout("Tokens")).toHaveTextContent("42");
    expect(readout("Cost")).toHaveTextContent("$1.50");
    await user.click(screen.getByText("Codex"));
    expect(readout("Tokens")).toHaveTextContent("2.0M");
    expect(readout("Cost")).toHaveTextContent("$7.00");
    await user.click(screen.getByText("Gemini"));
    expect(readout("Tokens")).toHaveTextContent("0");
  });

  it("copies the install command from the Install key", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    renderOwner();
    await user.click(screen.getByRole("button", { name: INSTALL_LABEL }));
    expect(writeText).toHaveBeenCalledWith("npx --yes vibeusage init");
  });

  it("captures the device with the Share key and opens X with the top model's display name", async () => {
    const shareLocation = new URL("https://www.vibeusage.cc/?screenshot=1");
    const originalLocation = window.location;
    window.location = shareLocation;
    window.history.replaceState({}, "", "/?screenshot=1");
    modelBreakdownHook.useUsageModelBreakdown.mockReturnValue(
      breakdown([
        {
          source: "claude",
          totals: { billable_total_tokens: 100 },
          models: [{ model: "anthropic/claude-opus-4.6", model_id: "anthropic/claude-opus-4.6", totals: { billable_total_tokens: 100 } }],
        },
      ]),
    );
    try {
      renderOwner({ auth: { userId: "user-1" } });
      fireEvent.click(screen.getByRole("button", { name: SHARE_LABEL }));
      await waitFor(() => expect(htmlToImage.toBlob).toHaveBeenCalled());
      expect(htmlToImage.toBlob.mock.calls[0][0].querySelector("[data-device]")).not.toBeNull();
      await waitFor(() => {
        expect(String(window.location.href)).toContain("claude-opus-4.6");
        expect(String(window.location.href)).not.toContain("anthropic%2Fclaude-opus-4.6");
      });
    } finally {
      window.location = originalLocation;
    }
  });

  it("locks the period to Total in screenshot mode", async () => {
    window.history.replaceState({}, "", "/?screenshot=1");
    renderOwner();
    expect(await screen.findByRole("radio", { name: "Total" })).toBeChecked();
    expect(trendHook.useTrendData.mock.calls.at(-1)?.[0].period).toBe("total");
  });
});

describe("DashboardPage owner states", () => {
  afterEach(() => {
    vi.clearAllMocks();
    usageDataHook.useUsageData.mockReset();
    heatmapHook.useActivityHeatmap.mockReset();
    vibeusageApi.getUserStatus.mockReset();
    vibeusageApi.getPublicVisibility.mockReset();
    vibeusageApi.setPublicVisibility.mockReset();
    vibeusageApi.requestInstallLinkCode.mockReset();
  });

  function quietYear({ latestDeviceSeenAt }) {
    usageDataHook.useUsageData.mockReturnValue(usage({ total_tokens: "0", billable_total_tokens: "0" }));
    heatmapHook.useActivityHeatmap.mockReturnValue({ ...activity(0), range: { from: "2025-03-08", to: "2026-03-07" } });
    vibeusageApi.getUserStatus.mockResolvedValue({
      subscriptions: { items: [] },
      install: { has_active_device_token: true, latest_device_seen_at: latestDeviceSeenAt },
    });
    vibeusageApi.getPublicVisibility.mockResolvedValue({ enabled: false, share_token: null, updated_at: null });
  }

  it("keeps the usage screen for a user who synced before but not this year", async () => {
    quietYear({ latestDeviceSeenAt: "2025-01-02T03:04:05Z" });
    renderOwner();
    await waitFor(() => expect(vibeusageApi.getUserStatus).toHaveBeenCalled());
    expect(await screen.findByRole("tab", { name: "Usage" })).toBeInTheDocument();
    expect(screen.queryByText("Waiting for first sync")).toBeNull();
  });

  it("shows the waiting screen while the installed device has never synced", async () => {
    quietYear({ latestDeviceSeenAt: null });
    renderOwner();
    expect(await screen.findByText("Waiting for first sync")).toBeInTheDocument();
  });

  it("puts the link-code install command on the screen before the first install", async () => {
    usageDataHook.useUsageData.mockReturnValue(usage({ total_tokens: "0" }));
    heatmapHook.useActivityHeatmap.mockReturnValue(activity(0));
    vibeusageApi.getUserStatus.mockResolvedValue({ subscriptions: { items: [] }, install: null });
    vibeusageApi.getPublicVisibility.mockResolvedValue({ enabled: false, share_token: null });
    vibeusageApi.requestInstallLinkCode.mockResolvedValue({ link_code: "lc-42", expires_at: new Date(Date.now() + 3_600_000).toISOString() });
    renderOwner();
    expect(await screen.findByText("npx --yes vibeusage init --link-code lc-42")).toBeInTheDocument();
  });

  it("disables Copy share link once the public profile is turned off", async () => {
    usageDataHook.useUsageData.mockReturnValue(usage({ total_tokens: "42", billable_total_tokens: "42" }));
    heatmapHook.useActivityHeatmap.mockReturnValue(activity(1));
    vibeusageApi.getUserStatus.mockResolvedValue({ subscriptions: { items: [] }, install: null });
    vibeusageApi.getPublicVisibility.mockResolvedValue({ enabled: true, updated_at: "2026-03-01T00:00:00Z", share_token: "pv1-abc" });
    vibeusageApi.setPublicVisibility.mockResolvedValue({ enabled: false, updated_at: "2026-03-07T00:00:00Z", share_token: null });
    renderOwner();
    const copyLink = screen.getByRole("button", { name: "Copy share link" });
    await waitFor(() => expect(copyLink).toBeEnabled());
    fireEvent.click(screen.getByRole("switch", { name: "Public profile" }));
    await waitFor(() => expect(vibeusageApi.setPublicVisibility).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: "Copy share link" })).toBeDisabled());
  });
});

describe("DashboardPage share link", () => {
  afterEach(() => {
    vi.clearAllMocks();
    usageDataHook.useUsageData.mockReset();
    heatmapHook.useActivityHeatmap.mockReset();
  });

  it("shows a visitor the same device without Install, Sign out or rank fetch", async () => {
    usageDataHook.useUsageData.mockReturnValue(usage({ total_tokens: "42", billable_total_tokens: "42" }));
    heatmapHook.useActivityHeatmap.mockReturnValue(activity(1));
    vibeusageApi.getPublicViewProfile.mockResolvedValue({ display_name: "ada" });
    renderOwner({ publicMode: true, publicToken: "pv1-abc" });
    expect(await screen.findByRole("region", { name: "@ada" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: SHARE_LABEL })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: INSTALL_LABEL })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    expect(screen.getByText("Public profile · read only")).toBeInTheDocument();
    expect(vibeusageApi.getLeaderboard).not.toHaveBeenCalled();
  });

  it("still offers Sign in to a visitor who is signed out", async () => {
    usageDataHook.useUsageData.mockReturnValue(usage({ total_tokens: "42" }));
    heatmapHook.useActivityHeatmap.mockReturnValue(activity(1));
    renderOwner({ publicMode: true, publicToken: "pv1-abc", signedIn: false });
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("says the link is wrong when the token is refused", async () => {
    usageDataHook.useUsageData.mockReturnValue({ ...usage(null), error: { status: 401, message: "Unauthorized" } });
    heatmapHook.useActivityHeatmap.mockReturnValue(activity(0));
    renderOwner({ publicMode: true, publicToken: "bad" });
    expect(await screen.findByText("This profile is private or the link is invalid.")).toBeInTheDocument();
  });
});
