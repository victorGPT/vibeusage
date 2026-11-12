import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render } from "../test/test-utils.tsx";
import { DashboardPage } from "./DashboardPage.jsx";

const TOTAL_TAB_LABEL = "Total";
const SHARE_TO_X_LABEL = "Share on X";

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
  requestInstallLinkCode: vi.fn(async () => ({ code: null, expires_at: null })),
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
describe("DashboardPage period decoupling", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    });
    htmlToImage.toBlob.mockClear();
    htmlToImage.toPng.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/");
    window.location = originalLocation;
  });

  it("does not wire period range into the recent usage hook when tabs change", async () => {
    render(
      <DashboardPage
        baseUrl="https://example.com"
        auth="token"
        currentIdentity={{ displayName: "Victor" }}
        signedIn
        sessionSoftExpired={false}
        signOut={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: TOTAL_TAB_LABEL })).toBeInTheDocument(),
    );

    expect(recentUsageHook.useRecentUsageData).toHaveBeenCalled();
    const firstCall = recentUsageHook.useRecentUsageData.mock.calls.at(-1)?.[0];
    expect(firstCall).not.toHaveProperty("from");
    expect(firstCall).not.toHaveProperty("to");
    expect(firstCall).not.toHaveProperty("period");

    fireEvent.click(screen.getByRole("button", { name: TOTAL_TAB_LABEL }));

    await waitFor(() => {
      const latestCall = recentUsageHook.useRecentUsageData.mock.calls.at(-1)?.[0];
      expect(latestCall).not.toHaveProperty("from");
      expect(latestCall).not.toHaveProperty("to");
      expect(latestCall).not.toHaveProperty("period");
    });
  });

  it("uses the shared display helper for screenshot share text when display_model is missing", async () => {
    const shareLocation = new URL("https://www.vibeusage.cc/?screenshot=1");
    window.location = shareLocation;
    window.history.replaceState({}, "", "/?screenshot=1");
    modelBreakdownHook.useUsageModelBreakdown.mockReturnValue({
      breakdown: {
        sources: [
          {
            source: "claude",
            totals: { billable_total_tokens: 100 },
            models: [
              {
                model: "anthropic/claude-opus-4.6",
                model_id: "anthropic/claude-opus-4.6",
                totals: { billable_total_tokens: 100 },
              },
            ],
          },
        ],
      },
      loading: false,
      source: "edge",
      error: null,
      refresh: vi.fn(),
    });

    render(
      <DashboardPage
        baseUrl="https://example.com"
        auth={{ userId: "user-1" }}
        currentIdentity={{ displayName: "Victor" }}
        signedIn
        sessionSoftExpired={false}
        signOut={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText(SHARE_TO_X_LABEL)).toBeInTheDocument());

    fireEvent.click(screen.getByText(SHARE_TO_X_LABEL));

    await waitFor(() => {
      expect(String(window.location.href)).toContain("claude-opus-4.6");
      expect(String(window.location.href)).not.toContain("anthropic%2Fclaude-opus-4.6");
    });
  });
});

describe("DashboardPage owner states", () => {
  function renderOwner() {
    return render(
      <DashboardPage
        baseUrl="https://example.com"
        auth="token"
        currentIdentity={{ displayName: "Victor" }}
        signedIn
        sessionSoftExpired={false}
        signOut={vi.fn()}
      />,
    );
  }

  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    usageDataHook.useUsageData.mockReset();
    heatmapHook.useActivityHeatmap.mockReset();
    vibeusageApi.getUserStatus.mockReset();
    vibeusageApi.getPublicVisibility.mockReset();
    vibeusageApi.setPublicVisibility.mockReset();
  });

  function quietYear({ latestDeviceSeenAt }) {
    usageDataHook.useUsageData.mockReturnValue({
      daily: [],
      summary: { total_tokens: "0", billable_total_tokens: "0" },
      rolling: null,
      source: "edge",
      loading: false,
      refreshing: false,
      error: null,
      refresh: vi.fn(),
    });
    heatmapHook.useActivityHeatmap.mockReturnValue({
      range: { from: "2025-03-08", to: "2026-03-07" },
      daily: [],
      heatmap: { weeks: [], active_days: 0 },
      loading: false,
      source: "edge",
      error: null,
      refresh: vi.fn(),
    });
    vibeusageApi.getUserStatus.mockResolvedValue({
      subscriptions: { items: [] },
      install: { has_active_device_token: true, latest_device_seen_at: latestDeviceSeenAt },
    });
    vibeusageApi.getPublicVisibility.mockResolvedValue({ enabled: false, share_token: null, updated_at: null });
  }

  it("keeps the readout and its period tabs for a user who synced before but not this year", async () => {
    quietYear({ latestDeviceSeenAt: "2025-01-02T03:04:05Z" });
    renderOwner();
    await waitFor(() => expect(vibeusageApi.getUserStatus).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: TOTAL_TAB_LABEL })).toBeInTheDocument();
    expect(screen.queryByText("Waiting for first sync")).toBeNull();
  });

  it("shows the waiting screen while the installed device has never synced", async () => {
    quietYear({ latestDeviceSeenAt: null });
    renderOwner();
    expect(await screen.findByText("Waiting for first sync")).toBeInTheDocument();
  });

  it("disables Copy share link once the public profile is turned off", async () => {
    usageDataHook.useUsageData.mockReturnValue({
      daily: [],
      summary: { total_tokens: "42", billable_total_tokens: "42" },
      rolling: null,
      source: "edge",
      loading: false,
      refreshing: false,
      error: null,
      refresh: vi.fn(),
    });
    heatmapHook.useActivityHeatmap.mockReturnValue({
      range: { from: "2026-01-01", to: "2026-03-07" },
      daily: [],
      heatmap: { weeks: [], active_days: 1 },
      loading: false,
      source: "edge",
      error: null,
      refresh: vi.fn(),
    });
    vibeusageApi.getUserStatus.mockResolvedValue({ subscriptions: { items: [] }, install: null });
    vibeusageApi.getPublicVisibility.mockResolvedValue({
      enabled: true,
      updated_at: "2026-03-01T00:00:00Z",
      share_token: "pv1-abc",
    });
    vibeusageApi.setPublicVisibility.mockResolvedValue({
      enabled: false,
      updated_at: "2026-03-07T00:00:00Z",
      share_token: null,
    });
    renderOwner();
    const copyLink = screen.getByRole("button", { name: "Copy share link" });
    await waitFor(() => expect(copyLink).toBeEnabled());
    fireEvent.click(screen.getByRole("switch", { name: "Public profile" }));
    await waitFor(() => expect(vibeusageApi.setPublicVisibility).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: "Copy share link" })).toBeDisabled());
  });
});
