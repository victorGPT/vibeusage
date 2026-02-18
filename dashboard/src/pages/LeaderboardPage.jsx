import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BackendStatus } from "../components/BackendStatus.jsx";
import { isAccessTokenReady, resolveAuthAccessToken } from "../lib/auth-token";
import { copy } from "../lib/copy";
import { toDisplayNumber } from "../lib/format";
import {
  buildPageItems,
  clampInt,
  getPaginationFlags,
  injectMeIntoFirstPage,
} from "../lib/leaderboard-ui";
import { isMockEnabled } from "../lib/mock-data";
import {
  getLeaderboard,
  getLeaderboardSettings,
  setLeaderboardSettings,
} from "../lib/vibeusage-api";
import { AsciiBox } from "../ui/foundation/AsciiBox.jsx";
import { MatrixButton } from "../ui/foundation/MatrixButton.jsx";
import { MatrixShell } from "../ui/foundation/MatrixShell.jsx";
import { GithubStar } from "../ui/matrix-a/components/GithubStar.jsx";

const PAGE_LIMIT = 20;

function normalizePeriod(value) {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (v === "week") return v;
  if (v === "month") return v;
  if (v === "total") return v;
  return null;
}

function normalizeLeaderboardError(err) {
  if (!err) return copy("shared.error.prefix", { error: copy("leaderboard.error.unknown") });
  const msg = err?.message || String(err);
  const safe = String(msg || "").trim() || copy("leaderboard.error.unknown");
  return copy("shared.error.prefix", { error: safe });
}

function normalizeName(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function isAnonymousName(value) {
  const normalized = normalizeName(value);
  if (!normalized) return true;
  return normalized.toLowerCase() === "anonymous";
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

export function LeaderboardPage({
  baseUrl,
  auth,
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

  let headerStatus = null;
  if (authTokenAllowed && authTokenReady) {
    headerStatus = <BackendStatus baseUrl={baseUrl} accessToken={effectiveAuthToken} />;
  }

  const headerRight = (
    <div className="ml-auto flex w-max min-w-max items-center gap-2 sm:gap-3 md:gap-4">
      <MatrixButton size="header" onClick={() => navigate("/")}>
        {copy("leaderboard.nav.back")}
      </MatrixButton>
      <GithubStar isFixed={false} size="header" className="hidden sm:inline-flex" />
      {signedIn ? (
        <MatrixButton onClick={signOut} size="header">
          {copy("dashboard.sign_out")}
        </MatrixButton>
      ) : (
        <MatrixButton as="a" size="header" href={signInUrl}>
          {copy("shared.button.sign_in")}
        </MatrixButton>
      )}
    </div>
  );

  const placeholder = copy("shared.placeholder.short");
  const [listPage, setListPage] = useState(1);
  const [listReloadToken, setListReloadToken] = useState(0);
  const [listState, setListState] = useState(() => ({
    loading: false,
    error: null,
    data: null,
  }));

  const [profileState, setProfileState] = useState(() => ({
    loading: false,
    saving: false,
    error: null,
    leaderboardPublic: null,
  }));

  const period = useMemo(() => {
    const params = new URLSearchParams(location?.search || "");
    return normalizePeriod(params.get("period")) || "week";
  }, [location?.search]);

  const periodSearch = location?.search || "";

  const handlePeriodChange = (nextPeriod) => {
    const normalized = normalizePeriod(nextPeriod);
    if (!normalized) return;
    if (normalized === period) return;
    const params = new URLSearchParams(location?.search || "");
    params.set("period", normalized);
    setListPage(1);
    navigate(`${location?.pathname || "/leaderboard"}?${params.toString()}`, { replace: true });
  };

  useEffect(() => {
    setListPage(1);
  }, [period]);

  useEffect(() => {
    if (mockEnabled) return;
    if (!authTokenAllowed) return;
    if (authTokenReady) return;
    setListState({ loading: false, error: null, data: null });
    setProfileState({
      loading: false,
      saving: false,
      error: null,
      leaderboardPublic: null,
    });
  }, [authTokenAllowed, authTokenReady, mockEnabled]);

  const listOffset = useMemo(() => {
    const safePage = clampInt(listPage, { min: 1, max: 1_000_000, fallback: 1 });
    return (safePage - 1) * PAGE_LIMIT;
  }, [listPage]);

  useEffect(() => {
    if (!baseUrl) return;
    if (mockEnabled) return;
    if (!authTokenAllowed || !authTokenReady) return;
    let active = true;
    setProfileState((prev) => ({ ...prev, loading: true, error: null }));
    (async () => {
      const token = await resolveAuthAccessToken(effectiveAuthToken);
      const data = await getLeaderboardSettings({ baseUrl, accessToken: token });
      if (!active) return;
      setProfileState((prev) => ({
        ...prev,
        loading: false,
        error: null,
        leaderboardPublic: Boolean(data?.leaderboard_public),
      }));
    })().catch((err) => {
      if (!active) return;
      setProfileState((prev) => ({
        ...prev,
        loading: false,
        error: normalizeLeaderboardError(err),
        leaderboardPublic: null,
      }));
    });
    return () => {
      active = false;
    };
  }, [authTokenAllowed, authTokenReady, baseUrl, effectiveAuthToken, mockEnabled]);

  useEffect(() => {
    if (!baseUrl) return;
    if (!mockEnabled && (!authTokenAllowed || !authTokenReady)) return;
    let active = true;
    setListState((prev) => ({ ...prev, loading: true, error: null }));
    (async () => {
      const token = await resolveAuthAccessToken(effectiveAuthToken);
      const data = await getLeaderboard({
        baseUrl,
        accessToken: token,
        period,
        limit: PAGE_LIMIT,
        offset: listOffset,
      });
      if (!active) return;
      setListState({ loading: false, error: null, data });
    })().catch((err) => {
      if (!active) return;
      setListState({ loading: false, error: normalizeLeaderboardError(err), data: null });
    });
    return () => {
      active = false;
    };
  }, [
    baseUrl,
    effectiveAuthToken,
    authTokenAllowed,
    authTokenReady,
    listOffset,
    listReloadToken,
    mockEnabled,
    period,
  ]);

  const listData = listState.data;

  const totalPages = listData?.total_pages ?? null;
  const currentPage = listData?.page ?? listPage;
  const pageItems = useMemo(() => {
    return buildPageItems(currentPage, totalPages);
  }, [currentPage, totalPages]);

  const from = listData?.from || null;
  const to = listData?.to || null;
  const generatedAt = listData?.generated_at || null;
  const me = listData?.me || null;
  const meLabel = copy("leaderboard.me_label");
  const anonLabel = copy("leaderboard.anon_label");
  const publicProfileLabel = copy("leaderboard.public_profile.label");
  const publicProfileStatusEnabledLabel = copy("leaderboard.public_profile.status.enabled");
  const publicProfileStatusDisabledLabel = copy("leaderboard.public_profile.status.disabled");
  const weekLabel = copy("leaderboard.period.week");
  const monthLabel = copy("leaderboard.period.month");
  const totalLabel = copy("leaderboard.period.total");
  const periodLabel = period === "month" ? monthLabel : period === "total" ? totalLabel : weekLabel;

  const displayEntries = useMemo(() => {
    const rows = Array.isArray(listData?.entries) ? listData.entries : [];
    if (currentPage !== 1) return rows;
    return injectMeIntoFirstPage({
      entries: rows,
      me,
      meLabel,
      limit: PAGE_LIMIT,
    });
  }, [currentPage, listData?.entries, me, meLabel]);

  const publicProfileEnabled = Boolean(profileState.leaderboardPublic);
  const publicProfileBusy = profileState.loading || profileState.saving;
  const publicProfileStatusLabel = publicProfileEnabled
    ? publicProfileStatusEnabledLabel
    : publicProfileStatusDisabledLabel;

  const handleTogglePublicProfile = async () => {
    if (!baseUrl) return;
    if (mockEnabled) return;
    if (!authTokenAllowed || !authTokenReady) return;
    if (publicProfileBusy) return;
    setProfileState((prev) => ({ ...prev, saving: true, error: null }));
    try {
      const token = await resolveAuthAccessToken(effectiveAuthToken);
      const nextValue = !publicProfileEnabled;
      const data = await setLeaderboardSettings({
        baseUrl,
        accessToken: token,
        leaderboardPublic: nextValue,
      });
      setProfileState((prev) => ({
        ...prev,
        saving: false,
        error: null,
        leaderboardPublic: Boolean(data?.leaderboard_public),
      }));
      setListReloadToken((value) => value + 1);
    } catch (err) {
      setProfileState((prev) => ({
        ...prev,
        saving: false,
        error: normalizeLeaderboardError(err),
      }));
    }
  };

  const { canPrev, canNext } = getPaginationFlags({ page: currentPage, totalPages });

  const hasEntries = Array.isArray(displayEntries) && displayEntries.length !== 0;
  let listBody = null;
  if (listState.loading) {
    listBody = (
      <div className="px-4">
        <p className="text-[10px] uppercase text-matrix-dim mt-0">{copy("leaderboard.loading")}</p>
      </div>
    );
  } else if (listState.error) {
    listBody = (
      <div className="px-4">
        <p className="text-[10px] uppercase text-matrix-dim mt-0">{listState.error}</p>
      </div>
    );
  } else if (hasEntries) {
    listBody = (
      <div className="w-full overflow-x-auto">
        <table className="w-full table-fixed text-left text-[12px]">
          <colgroup>
            <col className="w-[72px]" />
            <col />
            <col className="w-[112px]" />
            <col className="w-[112px]" />
            <col className="w-[112px]" />
            <col className="w-[112px]" />
          </colgroup>
          <thead className="uppercase text-matrix-dim tracking-[0.25em] text-[10px]">
            <tr className="border-b border-matrix-ghost">
              <th className="px-4 py-3">{copy("leaderboard.column.rank")}</th>
              <th className="px-4 py-3">{copy("leaderboard.column.user")}</th>
              <th className="px-4 py-3">{copy("leaderboard.column.total")}</th>
              <th className="px-4 py-3">{copy("leaderboard.column.gpt")}</th>
              <th className="px-4 py-3">{copy("leaderboard.column.claude")}</th>
              <th className="px-4 py-3">{copy("leaderboard.column.other")}</th>
            </tr>
          </thead>
          <tbody>
            {displayEntries.map((entry) => {
              const isMe = Boolean(entry?.is_me);
              const profileUserId = typeof entry?.user_id === "string" ? entry.user_id : null;
              const rawName = normalizeName(entry?.display_name);
              const entryName = isAnonymousName(rawName) ? anonLabel : rawName;
              const name = isMe ? meLabel : entryName;
              // Only clickable when: not me, has user_id, AND is_public=true (backend verified)
              const userLinkEnabled = Boolean(profileUserId) && !isMe && Boolean(entry?.is_public);
              const publicViewPath = userLinkEnabled
                ? buildPublicViewPath(profileUserId, periodSearch)
                : null;
              const rowClickable = Boolean(publicViewPath);
              if (isMe) {
                return (
                  <tr
                    key={`row-${entry?.rank}-${name}`}
                    className="border-b border-matrix-ghost/40"
                  >
                    <td colSpan={6} className="px-0 py-2">
                      <div className="rounded-none ring-1 ring-inset ring-matrix-primary/40 bg-matrix-panelStrong/70 backdrop-blur-panel shadow-matrix-glow">
                        <div className="grid grid-cols-[72px_minmax(0,1fr)_112px_112px_112px_112px] items-center text-[12px]">
                          <div className="px-4 py-3 font-black text-matrix-ink-bright glow-text">
                            {entry?.rank ?? placeholder}
                          </div>
                          <div className="px-4 py-3 font-black truncate text-matrix-ink-bright glow-text">
                            {name}
                          </div>
                          <div className="px-4 py-3 font-bold">
                            {toDisplayNumber(entry?.total_tokens)}
                          </div>
                          <div className="px-4 py-3 font-bold">
                            {toDisplayNumber(entry?.gpt_tokens)}
                          </div>
                          <div className="px-4 py-3 font-bold">
                            {toDisplayNumber(entry?.claude_tokens)}
                          </div>
                          <div className="px-4 py-3 font-bold">
                            {toDisplayNumber(entry?.other_tokens)}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              }
              return (
                <tr
                  key={`row-${entry?.rank}-${name}`}
                  className={`border-b border-matrix-ghost/40 bg-transparent ${
                    rowClickable ? "cursor-pointer hover:bg-matrix-panel/40" : ""
                  }`}
                  onClick={
                    rowClickable
                      ? () => {
                          if (typeof window !== "undefined") {
                            window.location.assign(publicViewPath);
                            return;
                          }
                          navigate(publicViewPath);
                        }
                      : undefined
                  }
                  onKeyDown={
                    rowClickable
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            if (typeof window !== "undefined") {
                              window.location.assign(publicViewPath);
                              return;
                            }
                            navigate(publicViewPath);
                          }
                        }
                      : undefined
                  }
                  role={rowClickable ? "link" : undefined}
                  tabIndex={rowClickable ? 0 : undefined}
                  aria-label={rowClickable ? `Open public dashboard for ${name}` : undefined}
                >
                  <td className="px-4 py-3 font-bold">{entry?.rank ?? placeholder}</td>
                  <td className="px-4 py-3 font-bold truncate max-w-[240px]">{name}</td>
                  <td className="px-4 py-3">{toDisplayNumber(entry?.total_tokens)}</td>
                  <td className="px-4 py-3">{toDisplayNumber(entry?.gpt_tokens)}</td>
                  <td className="px-4 py-3">{toDisplayNumber(entry?.claude_tokens)}</td>
                  <td className="px-4 py-3">{toDisplayNumber(entry?.other_tokens)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  } else {
    listBody = (
      <div className="px-4">
        <p className="text-[10px] uppercase text-matrix-dim mt-0">{copy("leaderboard.empty")}</p>
      </div>
    );
  }

  let pageButtons = null;
  if (typeof totalPages === "number") {
    pageButtons = pageItems.map((p, idx) => {
      if (p == null) {
        return (
          <span
            key={`ellipsis-${idx}`}
            className="text-[10px] uppercase tracking-[0.25em] text-matrix-dim px-2"
          >
            {copy("leaderboard.pagination.ellipsis")}
          </span>
        );
      }
      return (
        <MatrixButton
          key={`page-${p}`}
          size="sm"
          primary={p === currentPage}
          onClick={() => setListPage(p)}
          disabled={listState.loading}
        >
          {String(p)}
        </MatrixButton>
      );
    });
  } else {
    pageButtons = (
      <span className="text-[10px] uppercase tracking-[0.25em] text-matrix-dim">
        {copy("leaderboard.pagination.page_unknown", { page: String(currentPage) })}
      </span>
    );
  }

  return (
    <MatrixShell headerStatus={headerStatus} headerRight={headerRight}>
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="text-xl md:text-2xl font-black tracking-tight glow-text">
              {copy("leaderboard.title")}
            </h1>
            <div className="text-[10px] uppercase tracking-[0.25em] text-matrix-muted">
              {period === "total"
                ? copy("leaderboard.range.total")
                : from && to
                  ? copy("leaderboard.range", { period: periodLabel, from, to })
                  : copy("leaderboard.range_loading", { period: periodLabel })}
            </div>
          </div>
          {generatedAt ? (
            <div className="text-[10px] uppercase text-matrix-dim">
              {copy("leaderboard.generated_at", { ts: generatedAt })}
            </div>
          ) : null}
        </div>

        <AsciiBox
          title={copy("leaderboard.table.title")}
          subtitle={copy("leaderboard.table.subtitle")}
          className=""
          bodyClassName="px-0"
        >
          <div className="px-4 pb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MatrixButton
                size="sm"
                primary={period === "week"}
                onClick={() => handlePeriodChange("week")}
                disabled={listState.loading}
              >
                {weekLabel}
              </MatrixButton>
              <MatrixButton
                size="sm"
                primary={period === "month"}
                onClick={() => handlePeriodChange("month")}
                disabled={listState.loading}
              >
                {monthLabel}
              </MatrixButton>
              <MatrixButton
                size="sm"
                primary={period === "total"}
                onClick={() => handlePeriodChange("total")}
                disabled={listState.loading}
              >
                {totalLabel}
              </MatrixButton>
            </div>

            {authTokenAllowed && authTokenReady ? (
              <div className="flex items-center justify-end gap-3">
                {profileState.error ? (
                  <span className="text-[10px] uppercase tracking-[0.25em] text-matrix-dim">
                    {profileState.error}
                  </span>
                ) : null}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-matrix-dim">
                    {publicProfileLabel}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={publicProfileEnabled}
                      aria-label={publicProfileLabel}
                      title={publicProfileLabel}
                      onClick={handleTogglePublicProfile}
                      disabled={publicProfileBusy}
                      className={`relative inline-flex h-6 w-11 items-center border px-[3px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-matrix-primary/70 disabled:opacity-60 disabled:cursor-not-allowed ${
                        publicProfileEnabled
                          ? "border-matrix-primary bg-matrix-primary/10"
                          : "border-matrix-ghost/60 bg-matrix-panelStrong/40"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`inline-block h-3.5 w-3.5 bg-matrix-primary transition-transform ${
                          publicProfileEnabled
                            ? "translate-x-[18px] shadow-matrix-glow"
                            : "translate-x-0"
                        }`}
                      />
                    </button>
                    <span
                      className={`text-[10px] uppercase tracking-[0.2em] ${
                        publicProfileEnabled ? "text-matrix-primary/80" : "text-matrix-dim"
                      }`}
                    >
                      {publicProfileStatusLabel}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {listBody}

          <div className="px-4 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MatrixButton
                size="sm"
                onClick={() => setListPage((p) => Math.max(1, p - 1))}
                disabled={!canPrev || listState.loading}
              >
                {copy("leaderboard.pagination.prev")}
              </MatrixButton>
              <MatrixButton
                size="sm"
                onClick={() => setListPage((p) => p + 1)}
                disabled={!canNext || listState.loading}
              >
                {copy("leaderboard.pagination.next")}
              </MatrixButton>
            </div>
            <div className="flex flex-wrap items-center gap-2">{pageButtons}</div>
          </div>
        </AsciiBox>
      </div>
    </MatrixShell>
  );
}
