import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { isAccessTokenReady, resolveAuthAccessToken } from "../lib/auth-token";
import { copy } from "../lib/copy";
import { isMockEnabled } from "../lib/mock-data";
import { getLeaderboardProfile } from "../lib/vibeusage-api";
import { Label } from "../ui/2049/base/Label.tsx";
import { PageHeader } from "../ui/2049/base/PageHeader.tsx";
import { Stat } from "../ui/2049/base/Stat.tsx";
import { abbr, range } from "../ui/2049/blocks/format.ts";
import { IdentityBar } from "../ui/2049/blocks/IdentityBar.tsx";
import { displayName, periodLabel, rankText } from "../ui/2049/blocks/shared.ts";
import { StateScreen } from "../ui/2049/blocks/StateScreen.tsx";
import { TopNav } from "../ui/2049/blocks/TopNav.tsx";
import { Card } from "../ui/shadcn/card.tsx";
import { GITHUB_URL } from "./LeaderboardPage.jsx";

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

  const [reloadToken, setReloadToken] = useState(0);
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
    const controller = new AbortController();
    setProfileState((prev) => ({ ...prev, loading: true, error: null }));
    (async () => {
      const token = await resolveAuthAccessToken(effectiveAuthToken);
      const data = await getLeaderboardProfile({
        baseUrl,
        accessToken: token,
        userId,
        period,
        signal: controller.signal,
      });
      if (!active) return;
      setProfileState({ loading: false, error: null, data });
    })().catch((err) => {
      if (!active) return;
      setProfileState({ loading: false, error: err || new Error("unknown"), data: null });
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [authTokenAllowed, authTokenReady, baseUrl, effectiveAuthToken, mockEnabled, period, reloadToken, userId]);

  const data = profileState.data;
  const entry = data?.entry || null;
  const notFound = !userId || profileState.error?.status === 404 || (data && !entry);
  const name = entry ? displayName(entry) : null;
  const kicker = copy("leaderboard.profile.card.subtitle", { period: periodLabel(period) });
  const stats = entry
    ? [
        [copy("leaderboard.column.rank"), rankText(entry.rank)],
        [copy("daily.sort.total.label"), abbr(entry.total_tokens)],
        [copy("leaderboard.metric.gpt"), abbr(entry.gpt_tokens)],
        [copy("leaderboard.metric.claude"), abbr(entry.claude_tokens)],
        [copy("ui2049.rank_table.other"), abbr(entry.other_tokens)],
      ]
    : [];

  const signIn = () => window.location.assign(signInUrl);
  let body = null;
  if (notFound) {
    body = <StateScreen variant="invalid" />;
  } else if (!mockEnabled && !authTokenAllowed) {
    body = <StateScreen variant="expired" onSignIn={signIn} />;
  } else if (profileState.error) {
    body = <StateScreen variant="error" onRetry={() => setReloadToken((v) => v + 1)} />;
  } else if (!entry) {
    body = <StateScreen variant="loading" />;
  } else {
    body = (
      <>
        <IdentityBar handle={name} owner={false} />
        <Card role="region" aria-label={kicker} className="gap-6">
          <Label text={kicker} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-5">
            {stats.map(([label, value]) => (
              <Stat key={label} label={label} value={value} />
            ))}
          </div>
        </Card>
      </>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-12 font-sans text-copy-m font-medium text-foreground md:px-8">
      <div className="mx-auto flex max-w-304 flex-col gap-4">
        <TopNav
          active={null}
          signedIn={Boolean(signedIn)}
          dashboardHref="/"
          leaderboardHref={`/leaderboard${periodSearch}`}
          githubHref={GITHUB_URL}
          onSignIn={signIn}
          onSignOut={signOut}
        />
        <PageHeader
          title={name ?? copy("leaderboard.title")}
          meta={entry && data.from && data.to ? range(data.from, data.to) : undefined}
        />
        {body}
      </div>
    </main>
  );
}
