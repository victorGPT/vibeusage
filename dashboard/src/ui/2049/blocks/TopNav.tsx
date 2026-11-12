import { useEffect, useState } from "react";

import { copy } from "#src/lib/copy.ts";
import { fetchGithubRepoMeta } from "#src/lib/github-repo-meta.ts";
import { isScreenshotModeEnabled } from "#src/lib/screenshot-mode.js";
import { cn } from "#src/lib/utils.ts";
import { Button } from "#src/ui/shadcn/button.tsx";

type TopNavProps = {
  active: "dashboard" | "leaderboard" | null;
  signedIn: boolean;
  dashboardHref: string;
  leaderboardHref: string;
  githubHref: string;
  onSignIn?: () => void;
  onSignOut?: () => void;
};

// Page links dressed as ToggleGroup items: the current page carries the amber underline.
const LINK =
  "block border-b pb-2 font-sans text-label/none font-semibold uppercase tracking-label no-underline outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-4 focus-visible:outline-ring";

const REPO = "victorGPT/vibeusage";

// Screenshot mode skips the fetch so captures stay stable; a failed fetch leaves plain "GitHub".
function useGithubStars() {
  const [stars, setStars] = useState<number | null>(null);
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

// SSOT: design/2049/source/TopNav.dc.html.
export function TopNav(props: TopNavProps) {
  const stars = useGithubStars();
  const { active, signedIn, dashboardHref, leaderboardHref, githubHref, onSignIn, onSignOut } = props;
  const links = [
    { key: "dashboard", href: dashboardHref, label: copy("ui2049.top_nav.dashboard") },
    { key: "leaderboard", href: leaderboardHref, label: copy("leaderboard.title") },
  ];
  return (
    <header className="flex min-h-20 w-full flex-wrap items-center gap-x-8 gap-y-3 border-b border-border">
      <span className="font-display text-heading-xs/none font-light tracking-label text-hero">
        {copy("ui2049.top_nav.brand_vibe")}
        <span className="text-muted-foreground">{copy("ui2049.top_nav.brand_usage")}</span>
      </span>
      <nav aria-label={copy("ui2049.top_nav.nav_aria")}>
        <ul className="flex gap-4">
          {links.map((link) => (
            <li key={link.key}>
              <a
                href={link.href}
                aria-current={active === link.key ? "page" : undefined}
                className={cn(
                  LINK,
                  active === link.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-input hover:text-foreground",
                )}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="ml-auto flex gap-2">
        <Button
          variant="outline"
          className="max-sm:hidden"
          nativeButton={false}
          render={<a href={githubHref} target="_blank" rel="noopener noreferrer" />}
        >
          {stars == null ? copy("ui2049.top_nav.github") : copy("ui2049.top_nav.github_stars", { stars })}
          <span className="sr-only">{` ${copy("ui2049.top_nav.new_tab")}`}</span>
        </Button>
        {signedIn ? (
          <Button variant="outline" onClick={onSignOut}>
            {copy("dashboard.sign_out")}
          </Button>
        ) : (
          <Button onClick={onSignIn}>{copy("ui2049.top_nav.sign_in")}</Button>
        )}
      </div>
    </header>
  );
}
