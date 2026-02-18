import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { BackendStatus } from "../components/BackendStatus.jsx";
import { isAccessTokenReady, resolveAuthAccessToken } from "../lib/auth-token";
import { copy } from "../lib/copy";
import { toDisplayNumber } from "../lib/format";
import { isMockEnabled } from "../lib/mock-data";
import { getLeaderboardProfile } from "../lib/vibeusage-api";
import { AsciiBox } from "../ui/foundation/AsciiBox.jsx";
import { MatrixButton } from "../ui/foundation/MatrixButton.jsx";
import { MatrixShell } from "../ui/foundation/MatrixShell.jsx";
import { GithubStar } from "../ui/matrix-a/components/GithubStar.jsx";

function normalizeProfileError(err) {
  if (!err) return copy("shared.error.prefix", { error: copy("leaderboard.error.unknown") });
  const msg = err?.message || String(err);
  const safe = String(msg || "").trim() || copy("leaderboard.error.unknown");
  return copy("shared.error.prefix", { error: safe });
}

function normalizeName(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizePeriod(value) {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (v === "week") return v;
  if (v === "month") return v;
  if (v === "total") return v;
  return null;
}

export function LeaderboardProfilePage({
  baseUrl,
  auth,
  signedIn,
  sessionSoftExpired,
  signOut,
  signInUrl = "/sign-in",
  userId,
}) {
  const location = useLocation();
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
  const period = useMemo(() => {
    const params = new URLSearchParams(location?.search || "");
    return normalizePeriod(params.get("period")) || "week";
  }, [location?.search]);
  const periodSearch = location?.search || "";

  let headerStatus = null;
  if (authTokenAllowed && authTokenReady) {
    headerStatus = <BackendStatus baseUrl={baseUrl} accessToken={effectiveAuthToken} />;
  }

  const headerRight = (
    <div className="ml-auto flex w-max min-w-max items-center gap-2 sm:gap-3 md:gap-4">
      <MatrixButton as="a" size="header" href={`/leaderboard${periodSearch}`}>
        {copy("leaderboard.profile.nav.back")}
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

  const [profileState, setProfileState] = useState(() => ({
    loading: false,
    error: null,
    data: null,
  }));

  useEffect(() => {
    if (!baseUrl) return;
    if (!userId) return;
    if (!mockEnabled && (!authTokenAllowed || !authTokenReady)) return;
    let active = true;
    setProfileState((prev) => ({ ...prev, loading: true, error: null }));
    (async () => {
      const token = await resolveAuthAccessToken(effectiveAuthToken);
      const data = await getLeaderboardProfile({
        baseUrl,
        accessToken: token,
        userId,
        period,
      });
      if (!active) return;
      setProfileState({ loading: false, error: null, data });
    })().catch((err) => {
      if (!active) return;
      setProfileState({ loading: false, error: normalizeProfileError(err), data: null });
    });
    return () => {
      active = false;
    };
  }, [authTokenAllowed, authTokenReady, baseUrl, effectiveAuthToken, mockEnabled, period, userId]);

  const data = profileState.data;
  const from = data?.from || null;
  const to = data?.to || null;
  const generatedAt = data?.generated_at || null;
  const entry = data?.entry || null;

  const displayName = normalizeName(entry?.display_name) || copy("leaderboard.anon_label");
  const weekLabel = copy("leaderboard.period.week");
  const monthLabel = copy("leaderboard.period.month");
  const totalLabel = copy("leaderboard.period.total");
  const periodLabel = period === "month" ? monthLabel : period === "total" ? totalLabel : weekLabel;

  let body = null;
  if (!userId) {
    body = (
      <div className="px-4">
        <p className="text-[10px] uppercase text-matrix-dim mt-0">{copy("leaderboard.empty")}</p>
      </div>
    );
  } else if (profileState.loading) {
    body = (
      <div className="px-4">
        <p className="text-[10px] uppercase text-matrix-dim mt-0">{copy("leaderboard.loading")}</p>
      </div>
    );
  } else if (profileState.error) {
    body = (
      <div className="px-4">
        <p className="text-[10px] uppercase text-matrix-dim mt-0">{profileState.error}</p>
      </div>
    );
  } else if (entry) {
    body = (
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead className="uppercase text-matrix-dim tracking-[0.25em] text-[10px]">
            <tr className="border-b border-matrix-ghost">
              <th className="px-4 py-3">{copy("leaderboard.column.rank")}</th>
              <th className="px-4 py-3">{copy("leaderboard.column.total")}</th>
              <th className="px-4 py-3">{copy("leaderboard.column.gpt")}</th>
              <th className="px-4 py-3">{copy("leaderboard.column.claude")}</th>
              <th className="px-4 py-3">{copy("leaderboard.column.other")}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-matrix-ghost/40 bg-transparent">
              <td className="px-4 py-3 font-bold">
                {entry?.rank ?? copy("shared.placeholder.short")}
              </td>
              <td className="px-4 py-3">{toDisplayNumber(entry?.total_tokens)}</td>
              <td className="px-4 py-3">{toDisplayNumber(entry?.gpt_tokens)}</td>
              <td className="px-4 py-3">{toDisplayNumber(entry?.claude_tokens)}</td>
              <td className="px-4 py-3">{toDisplayNumber(entry?.other_tokens)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  } else {
    body = (
      <div className="px-4">
        <p className="text-[10px] uppercase text-matrix-dim mt-0">{copy("leaderboard.empty")}</p>
      </div>
    );
  }

  return (
    <MatrixShell headerStatus={headerStatus} headerRight={headerRight}>
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="text-xl md:text-2xl font-black tracking-tight glow-text">
              {displayName}
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
          title={copy("leaderboard.profile.card.title")}
          subtitle={copy("leaderboard.profile.card.subtitle", { period: periodLabel })}
          className=""
          bodyClassName="px-0"
        >
          {body}
        </AsciiBox>
      </div>
    </MatrixShell>
  );
}
