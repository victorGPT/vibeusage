import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isAccessTokenReady, resolveAuthAccessToken } from "../lib/auth-token";
import { copy } from "../lib/copy";
import { clampInt } from "../lib/leaderboard-ui";
import { isMockEnabled } from "../lib/mock-data";
import { getLeaderboard } from "../lib/vibeusage-api";
import { PageHeader } from "../ui/2049/base/PageHeader.tsx";
import { range } from "../ui/2049/blocks/format.ts";
import { LeaderboardFilters } from "../ui/2049/blocks/LeaderboardFilters.tsx";
import { MyRank } from "../ui/2049/blocks/MyRank.tsx";
import { RankList } from "../ui/2049/blocks/RankList.tsx";
import { RankTable } from "../ui/2049/blocks/RankTable.tsx";
import { StateScreen } from "../ui/2049/blocks/StateScreen.tsx";
import { TopNav } from "../ui/2049/blocks/TopNav.tsx";

const PAGE_LIMIT = 20;
export const GITHUB_URL = "https://github.com/victorGPT/vibeusage";

function normalizePeriod(value) {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (v === "week") return v;
  if (v === "month") return v;
  if (v === "total") return v;
  return null;
}

function normalizeMetric(value) {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return v === "all" || v === "gpt" || v === "claude" ? v : null;
}

function normalizeLeaderboardError(err) {
  if (!err) return copy("shared.error.prefix", { error: copy("leaderboard.error.unknown") });
  const msg = err?.message || String(err);
  const safe = String(msg || "").trim() || copy("leaderboard.error.unknown");
  return copy("shared.error.prefix", { error: safe });
}

function buildPublicViewPath(userId, search = "") {
  if (typeof userId !== "string") return null;
  const normalized = userId.trim().toLowerCase();
  if (!normalized) return null;

  const params = new URLSearchParams(typeof search === "string" ? search : "");
  const period = normalizePeriod(params.get("period"));
  const suffix = period ? `?period=${period}` : "";

  return `/share/pv1-${normalized}${suffix}`;
}

function handleFromIdentity(identity) {
  const raw = typeof identity?.displayName === "string" ? identity.displayName.trim() : "";
  const label = !raw || raw.includes("@") ? copy("dashboard.identity.fallback") : raw;
  return label.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// A slice of the board beside the paged table: the leaders for Top 10, the ranks around mine for MyRank.
function useBoardSlice({ enabled, baseUrl, authToken, period, metric, offset, limit, reloadToken }) {
  const [entries, setEntries] = useState([]);
  useEffect(() => {
    if (!enabled || offset == null) return;
    let active = true;
    const controller = new AbortController();
    (async () => {
      const token = authToken ? await resolveAuthAccessToken(authToken) : null;
      const data = await getLeaderboard({
        baseUrl,
        accessToken: token,
        period,
        metric,
        limit,
        offset,
        signal: controller.signal,
      });
      if (active) setEntries(Array.isArray(data?.entries) ? data.entries : []);
    })().catch(() => {
      if (active) setEntries([]);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [authToken, baseUrl, enabled, limit, metric, offset, period, reloadToken]);
  return entries;
}

export function LeaderboardPage({
  baseUrl,
  auth,
  currentIdentity,
  signedIn,
  sessionSoftExpired,
  signOut,
  signInUrl = "/sign-in",
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const mockEnabled = isMockEnabled();
  const authTokenAllowed = signedIn && !sessionSoftExpired;
  const authAccessToken = useMemo(() => {
    if (!authTokenAllowed) return null;
    if (typeof auth === "function") return auth;
    if (typeof auth === "string") return auth;
    if (auth && typeof auth === "object") return auth;
    return null;
  }, [auth, authTokenAllowed]);
  const effectiveAuthToken = authTokenAllowed ? authAccessToken : null;
  const authTokenReady = authTokenAllowed && isAccessTokenReady(effectiveAuthToken);
  const fetchReady = Boolean(baseUrl) && (mockEnabled || !authTokenAllowed || authTokenReady);

  const [listPage, setListPage] = useState(1);
  const [listReloadToken, setListReloadToken] = useState(0);
  const [listState, setListState] = useState(() => ({
    loading: false,
    error: null,
    data: null,
  }));

  const params = useMemo(() => new URLSearchParams(location?.search || ""), [location?.search]);
  const period = normalizePeriod(params.get("period")) || "week";
  const metric = normalizeMetric(params.get("metric")) || "all";
  const periodSearch = location?.search || "";

  const handleFilterChange = (key, value) => {
    if (!value || params.get(key) === value) return;
    const next = new URLSearchParams(location?.search || "");
    next.set(key, value);
    setListPage(1);
    navigate(`${location?.pathname || "/leaderboard"}?${next.toString()}`, { replace: true });
  };

  useEffect(() => {
    setListPage(1);
  }, [period, metric]);

  useEffect(() => {
    if (mockEnabled) return;
    if (!authTokenAllowed) return;
    if (authTokenReady) return;
    setListState({ loading: false, error: null, data: null });
  }, [authTokenAllowed, authTokenReady, mockEnabled]);

  const listOffset = useMemo(() => {
    const safePage = clampInt(listPage, { min: 1, max: 1_000_000, fallback: 1 });
    return (safePage - 1) * PAGE_LIMIT;
  }, [listPage]);

  useEffect(() => {
    if (!baseUrl) return;
    if (!mockEnabled && authTokenAllowed && !authTokenReady) return;
    let active = true;
    const controller = new AbortController();
    setListState((prev) => ({ ...prev, loading: true, error: null }));
    (async () => {
      const token = authTokenAllowed
        ? await resolveAuthAccessToken(effectiveAuthToken)
        : null;
      const data = await getLeaderboard({
        baseUrl,
        accessToken: token,
        period,
        metric,
        limit: PAGE_LIMIT,
        offset: listOffset,
        signal: controller.signal,
      });
      if (!active) return;
      setListState({ loading: false, error: null, data });
    })().catch((err) => {
      if (!active) return;
      setListState({ loading: false, error: normalizeLeaderboardError(err), data: null });
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    baseUrl,
    effectiveAuthToken,
    authTokenAllowed,
    authTokenReady,
    listOffset,
    listReloadToken,
    metric,
    mockEnabled,
    period,
  ]);

  const listData = listState.data;
  const me = listData?.me || null;
  const meRank = typeof me?.rank === "number" ? me.rank : null;
  const slice = {
    enabled: fetchReady,
    baseUrl,
    authToken: effectiveAuthToken,
    period,
    metric,
    reloadToken: listReloadToken,
  };
  const leaders = useBoardSlice({ ...slice, offset: 0, limit: 10 });
  const nearMe = useBoardSlice({
    ...slice,
    offset: meRank == null ? null : Math.max(0, meRank - 4),
    limit: 7,
  });

  const handle = handleFromIdentity(currentIdentity);
  const from = listData?.from || "";
  const to = listData?.to || "";
  const currentPage = listData?.page ?? listPage;
  const totalPages = listData?.total_pages ?? currentPage;
  const totalEntries = listData?.total_entries ?? 0;
  const profileHref = (entry) =>
    entry?.is_public ? buildPublicViewPath(entry.user_id, periodSearch) : null;

  let board = null;
  if (listState.error) {
    board = <StateScreen variant="error" onRetry={() => setListReloadToken((v) => v + 1)} />;
  } else if (!listData) {
    board = <StateScreen variant="loading" />;
  } else {
    board = (
      <>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <MyRank
              me={me}
              entries={nearMe}
              totalEntries={totalEntries}
              period={period}
              metric={metric}
              from={from}
              to={to}
              handle={handle}
            />
          </div>
          <div className="lg:col-span-4">
            <RankList entries={leaders} period={period} handle={handle} profileHref={profileHref} />
          </div>
        </div>
        <RankTable
          entries={Array.isArray(listData.entries) ? listData.entries : []}
          me={me}
          handle={handle}
          page={currentPage}
          totalPages={totalPages}
          totalEntries={totalEntries}
          period={period}
          onPageChange={setListPage}
          onJumpToMe={meRank == null ? undefined : () => setListPage(Math.ceil(meRank / PAGE_LIMIT))}
          profileHref={profileHref}
        />
      </>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-12 font-sans text-copy-m font-medium text-foreground md:px-8">
      <div className="mx-auto flex max-w-304 flex-col gap-4">
        <TopNav
          active="leaderboard"
          signedIn={Boolean(signedIn)}
          dashboardHref="/"
          leaderboardHref="/leaderboard"
          githubHref={GITHUB_URL}
          onSignIn={() => window.location.assign(signInUrl)}
          onSignOut={signOut}
        />
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <div className="min-w-0 flex-auto basis-90">
            <PageHeader title={copy("leaderboard.title")} meta={from && to ? range(from, to) : undefined} />
          </div>
          <LeaderboardFilters
            period={period}
            onPeriodChange={(value) => handleFilterChange("period", value)}
            metric={metric}
            onMetricChange={(value) => handleFilterChange("metric", value)}
          />
        </div>
        {board}
      </div>
    </main>
  );
}
