import React, { useEffect, useMemo, useState } from "react";
import { copy } from "../lib/copy";
import { getAppVersion } from "../lib/app-version";
import { formatDateUTC } from "../lib/date-range";
import { fetchGithubRepoMeta } from "../lib/github-repo-meta";
import { isScreenshotModeEnabled } from "../lib/screenshot-mode";
import { CtaBand } from "../ui/2049/base/CtaBand";
import { Features } from "../ui/2049/blocks/Features";
import { LandingHero } from "../ui/2049/blocks/LandingHero";
import { Readout } from "../ui/2049/blocks/Readout";
import { TopNav } from "../ui/2049/blocks/TopNav";

const REPO = "victorGPT/vibeusage";
const COL_6 = "min-w-[min(100%,420px)] flex-[1_1_calc((100%-176px)*6/12+80px)]";

// The landing board's sample account, frozen so the hero never depends on a signed-in fetch.
const SAMPLE_TOTALS = { total_tokens: 195_893_152, total_cost_usd: "60.28" };
const SAMPLE_TOKENS = [589_300_000, 489_700_000, 407_500_000];

function useGithubStars(enabled) {
  const [stars, setStars] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    fetchGithubRepoMeta(REPO)
      .then((meta) => active && setStars(meta?.stars ?? null))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [enabled]);
  return stars;
}

export function LandingPage({ signUpUrl }) {
  const appVersion = useMemo(() => getAppVersion(import.meta.env), []);
  const screenshotMode = useMemo(
    () => typeof window !== "undefined" && isScreenshotModeEnabled(window.location.search),
    [],
  );
  const stars = useGithubStars(!screenshotMode);
  const sampleRange = useMemo(() => {
    const today = Date.now();
    return { from: formatDateUTC(new Date(today - 6 * 86_400_000)), to: formatDateUTC(new Date(today)) };
  }, []);

  const sampleBoard = useMemo(
    () =>
      String(copy("ui2049.landing.sample_names"))
        .split(",")
        .map((name, i) => ({ rank: i + 1, display_name: name, total_tokens: SAMPLE_TOKENS[i] })),
    [],
  );

  useEffect(() => {
    try {
      window.sessionStorage.setItem("vibeusage.dashboard.from_landing.v1", "1");
    } catch (_e) {
      // private mode or quota: the flag is best-effort
    }
  }, []);

  return (
    <main className="min-h-screen bg-background px-4 pb-12 font-sans text-copy-m font-medium text-foreground md:px-8">
      <div className="mx-auto flex max-w-[1216px] flex-col gap-12">
        <TopNav
          active={null}
          signedIn={false}
          stars={stars}
          dashboardHref="/"
          leaderboardHref="/leaderboard"
          githubHref={`https://github.com/${REPO}`}
          onSignIn={() => window.location.assign(signUpUrl)}
        />
        <div className="flex flex-wrap items-center gap-4">
          <div className={COL_6}>
            <LandingHero signInHref={signUpUrl} />
          </div>
          <div className={COL_6}>
            <Readout
              mode="sample"
              period="week"
              totals={SAMPLE_TOTALS}
              from={sampleRange.from}
              to={sampleRange.to}
              handle={copy("ui2049.landing.sample_handle")}
              board={sampleBoard}
            />
          </div>
        </div>
        <Features />
        <CtaBand
          title={copy("ui2049.landing.cta_title")}
          buttonLabel={copy("ui2049.state_screen.sign_in")}
          href={signUpUrl}
          meta={copy("ui2049.landing.cta_meta", { version: appVersion })}
        />
      </div>
    </main>
  );
}
