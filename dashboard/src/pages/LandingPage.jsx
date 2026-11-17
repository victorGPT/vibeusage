import React, { useEffect, useState } from "react";

import { copy } from "../lib/copy";
import { fetchGithubRepoMeta } from "../lib/github-repo-meta";
import { isScreenshotModeEnabled } from "../lib/screenshot-mode.js";
import { Device } from "../ui/hardware/device";
import { ClientList } from "../ui/vu1/ClientList";
import { GlobalMeter } from "../ui/vu1/GlobalMeter";
import { InstallCommand } from "../ui/vu1/InstallCommand";
import { TopBar } from "../ui/vu1/TopBar";
import "../ui/vu1/landing.css";

const REPO = "victorGPT/vibeusage";
const HREFS = { home: "/", dashboard: "/", leaderboard: "/leaderboard" };

// ponytail: frozen example figures; no site-wide endpoint exists and the backend stays as is.
const SAMPLE = {
  tokens: 8_410_000_000,
  cost: 21_700,
  users: 3912,
  bars: [31, 24, 18, 15, 14, 19, 28, 42, 58, 71, 80, 86, 83, 88, 92, 95, 90, 84, 77, 70, 64, 57, 48, 39],
};

const SPECS = [1, 2, 3];
const POINTS = ["point1", "point2", "point3"];

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

export function LandingPage({ signUpUrl }) {
  const stars = useGithubStars();

  useEffect(() => {
    try {
      window.sessionStorage.setItem("vibeusage.dashboard.from_landing.v1", "1");
    } catch (_e) {
      // private mode or quota: the flag is best-effort
    }
  }, []);

  return (
    <div data-vu1="landing" className="px-s4 pt-s4 pb-s8">
      <div className="mx-auto flex max-w-shell flex-col gap-s6 min-[761px]:gap-s8">
        <TopBar
          active="home"
          signedIn={false}
          hrefs={HREFS}
          githubHref={`https://github.com/${REPO}`}
          stars={stars}
          onSignIn={() => window.location.assign(signUpUrl)}
        />
        <main className="grid-page gap-y-s4">
          <section className="col-span-12 flex flex-col gap-s4 self-center min-[761px]:col-span-6 min-[761px]:gap-s5">
            <div className="flex flex-col gap-s3">
              <p data-vu1-cap="" data-vu1="dim" className="m-0">
                {copy("vu1.landing.eyebrow")}
              </p>
              <h1 data-vu1="hero-title">{copy("vu1.landing.title")}</h1>
            </div>
            <p data-vu1="prose">{copy("vu1.landing.body")}</p>
            <InstallCommand command={copy("landing.install.command")} />
            <ClientList />
            <div data-vu1-cap="" className="flex flex-wrap gap-s3">
              <a data-kit="button" data-tone="primary" data-vu1="cta" href={signUpUrl}>
                {copy("vu1.landing.sign_in")}
              </a>
              <a data-kit="button" data-tone="secondary" data-vu1="cta" href="/leaderboard">
                {copy("vu1.landing.leaderboard")}
              </a>
            </div>
          </section>
          <div className="col-span-12 self-center [--device-w:100%] min-[761px]:col-start-8 min-[761px]:col-end-13">
            <Device model={copy("vu1.device.name")} name={copy("vu1.landing.meter_name")}>
              <div className="flex flex-col gap-s5">
                <GlobalMeter {...SAMPLE} />
                <p data-vu1="legend" className="m-0">
                  {copy("vu1.landing.meter_note")}
                </p>
              </div>
            </Device>
          </div>
          <section
            aria-label={copy("vu1.landing.specs_aria")}
            className="col-span-12 mt-s7 grid-page gap-y-s5 min-[761px]:mt-s8"
          >
            {SPECS.map((n) => (
              <div key={n} className="col-span-12 flex flex-col gap-s2 pt-s4 min-[761px]:col-span-4">
                <h3 data-vu1="spec-title">{copy(`vu1.landing.spec${n}_title`)}</h3>
                <p data-vu1="prose" data-wide="">
                  {copy(`vu1.landing.spec${n}_body`)}
                </p>
              </div>
            ))}
          </section>
          <section className="col-span-12 mt-s8 flex flex-col gap-s2">
            <p data-vu1-cap="" data-vu1="dim" className="m-0">
              {copy("landing.features.title")}
            </p>
            <h2 data-vu1="spec-title">{copy("landing.seo.title")}</h2>
            <p data-vu1="prose" data-wide="">
              {copy("landing.seo.summary")}
            </p>
            <ul className="m-0 flex list-none flex-col gap-s1 p-0">
              {POINTS.map((k) => (
                <li key={k} data-vu1="prose" data-wide="">
                  {copy(`landing.seo.${k}`)}
                </li>
              ))}
            </ul>
            <p data-vu1="prose" data-wide="">
              {copy("landing.seo.roadmap")}
            </p>
          </section>
          <p data-vu1-cap="" data-vu1="foot" className="col-span-12 m-0 mt-s8">
            {copy("vu1.landing.foot")}
          </p>
        </main>
      </div>
    </div>
  );
}
