import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isAccessTokenReady, resolveAuthAccessToken } from "../lib/auth-token";
import { copy } from "../lib/copy";
import { fetchGithubRepoMeta } from "../lib/github-repo-meta";
import { isMockEnabled } from "../lib/mock-data";
import { isScreenshotModeEnabled } from "../lib/screenshot-mode";
import { getLeaderboard } from "../lib/vibeusage-api";
import { Device, DevicePlate } from "../ui/hardware/device.tsx";
import { periodOptions } from "../ui/vu1/labels.ts";
import { MyRankLcd } from "../ui/vu1/MyRankLcd.tsx";
import { Pager } from "../ui/vu1/Pager.tsx";
import { RankScreen } from "../ui/vu1/RankScreen.tsx";
import { Segment } from "../ui/vu1/SourceSegment.tsx";
import { StateScreen } from "../ui/vu1/StateScreen.tsx";
import { TopBar } from "../ui/vu1/TopBar.tsx";
import { UpgradeToast } from "../ui/vu1/UpgradeToast.tsx";

const PAGE_LIMIT = 10;
const METRIC = "all";
const REPO = "victorGPT/vibeusage";
export const GITHUB_URL = `https://github.com/${REPO}`;
const HREFS = { home: "/", dashboard: "/", leaderboard: "/leaderboard" };
const BOARDS = periodOptions().filter((option) => option.value !== "day");

function normalizePeriod(value) {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return BOARDS.some((option) => option.value === v) ? v : "week";
}

function handleFromIdentity(identity) {
  const raw = typeof identity?.displayName === "string" ? identity.displayName.trim() : "";
  const label = !raw || raw.includes("@") ? copy("dashboard.identity.fallback") : raw;
  return label.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Screenshot mode skips the fetch so captures stay stable; a failed fetch leaves plain "GitHub".
function useGithubStars() {
  const [stars, setStars] = useState(null);
  useEffect(() => {
    if (isScreenshotModeEnabled(window.location.search)) return undefined;
    let active = true;
    fetchGithubRepoMeta(REPO)
      .then((meta) => active && setStars(meta.stars))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return stars;
}

const NO_ROWS = [];

// Ranks are dense (tied rows share one), so the rows ranked meRank - 1 start at row meRank - 2 or later.
// The row to pass is the last one ranked above me before my row; the gap screen needs it from any page.
// ponytail: walks at most five windows of 100 rows, so more than ~500 tied rows around me gives up.
async function rowAheadOfMe(rows, meRank) {
  if (meRank <= 1) return NO_ROWS;
  let offset = meRank - 2;
  let ahead = null;
  for (let step = 0; step < 5; step += 1) {
    const page = await rows(offset, 100);
    for (const entry of page) {
      if (entry?.is_me) return ahead ? [ahead] : NO_ROWS;
      if (entry.rank < meRank) ahead = entry;
    }
    if (page.length < 100) break;
    offset += page.length;
  }
  return NO_ROWS;
}

const copyUpgradeCommand = () => {
  navigator.clipboard?.writeText(copy("dashboard.upgrade_alert.install_command")).catch(() => {});
};

export function LeaderboardPage({
  baseUrl,
  auth,
  currentIdentity,
  signedIn,
  sessionSoftExpired,
  signOut,
  signInUrl = "/sign-in",
  latestVersion = null,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const stars = useGithubStars();
  const mockEnabled = isMockEnabled();
  const authTokenAllowed = signedIn && !sessionSoftExpired;
  const authToken = authTokenAllowed && auth ? auth : null;
  const authTokenReady = authTokenAllowed && isAccessTokenReady(authToken);
  const fetchReady = Boolean(baseUrl) && (mockEnabled || !authTokenAllowed || authTokenReady);

  const period = useMemo(() => normalizePeriod(new URLSearchParams(location?.search || "").get("period")), [location?.search]);
  // The page belongs to the board it was picked on, so a new period starts at page 1 without a stale fetch.
  const [paged, setPaged] = useState({ period, page: 1 });
  if (paged.period !== period) setPaged({ period, page: 1 });
  const page = paged.period === period ? paged.page : 1;
  const setPage = (next) => setPaged({ period, page: next });
  const [reloadToken, setReloadToken] = useState(0);
  const [board, setBoard] = useState({ error: false, data: null });
  const [above, setAbove] = useState(NO_ROWS);

  const choosePeriod = (value) => {
    const next = new URLSearchParams(location?.search || "");
    next.set("period", value);
    navigate(`${location?.pathname || "/leaderboard"}?${next.toString()}`, { replace: true });
  };

  const me = board.data?.me ?? null;
  const meRank = typeof me?.rank === "number" ? me.rank : null;

  useEffect(() => {
    if (!fetchReady) return undefined;
    let active = true;
    const controller = new AbortController();
    const rows = async (offset, limit) => {
      const accessToken = authToken ? await resolveAuthAccessToken(authToken) : null;
      return getLeaderboard({ baseUrl, accessToken, period, metric: METRIC, limit, offset, signal: controller.signal });
    };
    setBoard((prev) => ({ ...prev, error: false }));
    rows((page - 1) * PAGE_LIMIT, PAGE_LIMIT).then(
      (data) => active && setBoard({ error: false, data }),
      () => active && setBoard({ error: true, data: null }),
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [authToken, baseUrl, fetchReady, page, period, reloadToken]);

  useEffect(() => {
    if (!fetchReady || meRank == null) return undefined;
    let active = true;
    const controller = new AbortController();
    const rows = async (offset, limit) => {
      const accessToken = authToken ? await resolveAuthAccessToken(authToken) : null;
      const data = await getLeaderboard({ baseUrl, accessToken, period, metric: METRIC, limit, offset, signal: controller.signal });
      return Array.isArray(data?.entries) ? data.entries : NO_ROWS;
    };
    rowAheadOfMe(rows, meRank).then(
      (next) => active && setAbove(next),
      () => active && setAbove(NO_ROWS),
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [authToken, baseUrl, fetchReady, meRank, period, reloadToken]);

  const entries = Array.isArray(board.data?.entries) ? board.data.entries : NO_ROWS;
  const totalEntries = board.data?.total_entries ?? 0;

  let body;
  if (board.error) {
    body = <StateScreen variant="error" onRetry={() => setReloadToken((v) => v + 1)} />;
  } else if (!board.data) {
    body = <StateScreen variant="loading" />;
  } else if (totalEntries === 0) {
    body = <StateScreen variant="empty" />;
  } else {
    body = <RankScreen entries={entries} me={me} handle={handleFromIdentity(currentIdentity)} frame="single" />;
  }

  return (
    <div className="px-s4 pt-s4 pb-s8">
      <div className="mx-auto max-w-shell">
        <TopBar
          active="leaderboard"
          signedIn={Boolean(signedIn)}
          hrefs={HREFS}
          githubHref={GITHUB_URL}
          stars={stars}
          onSignIn={() => window.location.assign(signInUrl)}
          onSignOut={signOut}
        />
        <main className="grid-page mt-s6 min-[761px]:mt-s8">
          <div className="col-span-12 lg:col-start-3 lg:col-end-11 [--device-w:100%]">
            <Device model={copy("vu1.device.name")} name={copy("vu1.top.leaderboard")} plate="none">
              <div className="grid-device gap-y-s5">
                <div className="col-span-12 flex items-baseline justify-between gap-s2">
                  <DevicePlate model={copy("vu1.device.name")} name={copy("vu1.top.leaderboard")} />
                  {board.data ? (
                    <span data-vu1="dim" data-vu1-cap="">
                      {copy("vu1.board.users", { count: totalEntries.toLocaleString("en-US") })}
                    </span>
                  ) : null}
                </div>
                <div className="col-span-12 min-[761px]:col-span-6">
                  <Segment label={copy("vu1.period.label")} options={BOARDS} value={period} onChange={choosePeriod} print="key" />
                </div>
                <div className="col-span-12 flex items-center min-[761px]:col-span-6 min-[761px]:justify-end">
                  <MyRankLcd me={me} entries={[...above, ...entries]} />
                </div>
                <div className="col-span-12">{body}</div>
                {totalEntries ? (
                  <div className="col-span-12">
                    <Pager page={board.data.page ?? page} pageCount={board.data.total_pages ?? page} onPageChange={setPage} />
                  </div>
                ) : null}
              </div>
            </Device>
          </div>
        </main>
      </div>
      {latestVersion && !isScreenshotModeEnabled(window.location.search) ? <UpgradeToast requiredVersion={latestVersion} onUpdate={copyUpgradeCommand} /> : null}
    </div>
  );
}
