import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useRecentUsageData } from "./use-recent-usage-data";

const authToken = vi.hoisted(() => ({
  isAccessTokenReady: vi.fn((token: any) => Boolean(token)),
  resolveAuthAccessToken: vi.fn(async (token: any) => token ?? null),
}));

const dashboardCache = vi.hoisted(() => ({
  buildDashboardCacheKey: vi.fn(() => "recent-usage-cache-key"),
  clearDashboardCache: vi.fn(),
  readDashboardCache: vi.fn(() => null as any),
  writeDashboardCache: vi.fn(),
}));

const liveSnapshots = vi.hoisted(() => ({
  readDashboardLiveSnapshot: vi.fn(() => null as any),
  writeDashboardLiveSnapshot: vi.fn(),
}));

const mockData = vi.hoisted(() => ({
  isMockEnabled: vi.fn(() => false),
}));

const timezone = vi.hoisted(() => ({
  getLocalDayKey: vi.fn(() => "2026-03-07"),
  getTimeZoneCacheKey: vi.fn(() => "tz:utc"),
}));

const vibeusageApi = vi.hoisted(() => ({
  getUsageSummary: vi.fn(async () => ({ totals: null, rolling: null })),
}));

vi.mock("../lib/auth-token", () => authToken);
vi.mock("../lib/dashboard-cache", () => dashboardCache);
vi.mock("../lib/dashboard-live-snapshot", () => liveSnapshots);
vi.mock("../lib/mock-data", () => mockData);
vi.mock("../lib/timezone", () => timezone);
vi.mock("../lib/vibeusage-api", () => vibeusageApi);

describe("useRecentUsageData", () => {
  afterEach(() => {
    authToken.isAccessTokenReady.mockReset();
    authToken.isAccessTokenReady.mockImplementation((token: any) => Boolean(token));
    authToken.resolveAuthAccessToken.mockReset();
    authToken.resolveAuthAccessToken.mockImplementation(async (token: any) => token ?? null);

    dashboardCache.buildDashboardCacheKey.mockReset();
    dashboardCache.buildDashboardCacheKey.mockReturnValue("recent-usage-cache-key");
    dashboardCache.clearDashboardCache.mockReset();
    dashboardCache.readDashboardCache.mockReset();
    dashboardCache.readDashboardCache.mockReturnValue(null);
    dashboardCache.writeDashboardCache.mockReset();
    liveSnapshots.readDashboardLiveSnapshot.mockReset();
    liveSnapshots.readDashboardLiveSnapshot.mockReturnValue(null);
    liveSnapshots.writeDashboardLiveSnapshot.mockReset();

    mockData.isMockEnabled.mockReset();
    mockData.isMockEnabled.mockReturnValue(false);

    timezone.getLocalDayKey.mockReset();
    timezone.getLocalDayKey.mockReturnValue("2026-03-07");
    timezone.getTimeZoneCacheKey.mockReset();
    timezone.getTimeZoneCacheKey.mockReturnValue("tz:utc");

    vibeusageApi.getUsageSummary.mockReset();
    vibeusageApi.getUsageSummary.mockResolvedValue({ totals: null, rolling: null });
  });

  it("keeps the previous rolling payload visible while refreshing", async () => {
    const resolvers: Array<(value: any) => void> = [];
    vibeusageApi.getUsageSummary.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const { result } = renderHook(() =>
      useRecentUsageData({
        baseUrl: "https://example.com",
        accessToken: "token",
        cacheKey: "user-1",
        timeZone: "UTC",
        tzOffsetMinutes: 0,
        now: new Date("2026-03-07T00:00:00Z"),
      }),
    );

    await waitFor(() => expect(vibeusageApi.getUsageSummary).toHaveBeenCalledTimes(1));

    await act(async () => {
      resolvers.shift()?.({
        totals: null,
        rolling: { last_7d: { totals: { billable_total_tokens: "42" } } },
      });
    });

    await waitFor(() =>
      expect(result.current.rolling).toEqual({
        last_7d: { totals: { billable_total_tokens: "42" } },
      }),
    );

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => expect(vibeusageApi.getUsageSummary).toHaveBeenCalledTimes(2));
    expect(result.current.loading).toBe(true);
    expect(result.current.rolling).toEqual({
      last_7d: { totals: { billable_total_tokens: "42" } },
    });
  });

  it("hydrates a resolved recent-usage snapshot immediately while refreshing in the background", async () => {
    liveSnapshots.readDashboardLiveSnapshot.mockReturnValue({
      rolling: { last_7d: { totals: { billable_total_tokens: "84" } } },
      fetchedAt: "2026-03-07T00:00:00.000Z",
    });

    let resolveSummary: ((value: any) => void) | null = null;
    vibeusageApi.getUsageSummary.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSummary = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useRecentUsageData({
        baseUrl: "https://example.com",
        accessToken: "token",
        cacheKey: "user-1",
        timeZone: "UTC",
        tzOffsetMinutes: 0,
        now: new Date("2026-03-07T00:00:00Z"),
      }),
    );

    await waitFor(() => expect(vibeusageApi.getUsageSummary).toHaveBeenCalledTimes(1));
    expect(result.current.source).toBe("edge");
    expect(result.current.fetchedAt).toBe("2026-03-07T00:00:00.000Z");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.rolling).toEqual({
      last_7d: { totals: { billable_total_tokens: "84" } },
    });

    await act(async () => {
      resolveSummary?.({
        totals: null,
        rolling: { last_7d: { totals: { billable_total_tokens: "126" } } },
      });
    });

    await waitFor(() =>
      expect(result.current.rolling).toEqual({
        last_7d: { totals: { billable_total_tokens: "126" } },
      }),
    );
    expect(result.current.source).toBe("edge");
  });
  it("clears the immediate snapshot override after a failed refresh and reports cache provenance honestly", async () => {
    liveSnapshots.readDashboardLiveSnapshot.mockReturnValue({
      rolling: { last_7d: { totals: { billable_total_tokens: "84" } } },
      fetchedAt: "2026-03-07T00:00:00.000Z",
    });
    dashboardCache.readDashboardCache.mockReturnValue({
      rolling: { last_7d: { totals: { billable_total_tokens: "63" } } },
      fetchedAt: "2026-03-06T23:00:00.000Z",
    });
    vibeusageApi.getUsageSummary.mockRejectedValue(new Error("backend unavailable"));

    const { result } = renderHook(() =>
      useRecentUsageData({
        baseUrl: "https://example.com",
        accessToken: "token",
        cacheKey: "user-1",
        timeZone: "UTC",
        tzOffsetMinutes: 0,
        now: new Date("2026-03-07T00:00:00Z"),
      }),
    );

    await waitFor(() => expect(vibeusageApi.getUsageSummary).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.source).toBe("cache");
    expect(result.current.error).toBeNull();
    expect(result.current.fetchedAt).toBe("2026-03-06T23:00:00.000Z");
    expect(result.current.rolling).toEqual({
      last_7d: { totals: { billable_total_tokens: "63" } },
    });
  });
});
