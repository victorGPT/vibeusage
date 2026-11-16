import { LogoGithub } from "@carbon/icons-react";
import { useSyncExternalStore } from "react";

import { copy } from "#src/lib/copy.ts";
import { Button } from "#src/ui/hardware/button.tsx";
import { Icon } from "#src/ui/hardware/icon.tsx";
import { onSoundChange, setSoundEnabled, soundEnabled } from "#src/ui/hardware/lib/sound.ts";
import "./blocks.css";

const serverSound = () => false;

type Page = "home" | "dashboard" | "leaderboard";

type TopBarProps = {
  active: Page | null;
  signedIn: boolean;
  hrefs: Record<Page, string>;
  githubHref: string;
  // null until the star count loads, or when it fails: the key then reads plain "GitHub".
  stars: number | null;
  onSignIn?: () => void;
  onSignOut?: () => void;
};

export function TopBar({ active, signedIn, hrefs, githubHref, stars, onSignIn, onSignOut }: TopBarProps) {
  const sound = useSyncExternalStore(onSoundChange, soundEnabled, serverSound);
  const links: [Page, string][] = [
    ["home", copy("vu1.top.home")],
    ["dashboard", copy("vu1.top.dashboard")],
    ["leaderboard", copy("vu1.top.leaderboard")],
  ];
  return (
    <header data-vu1="topbar">
      <span data-vu1="brand">
        <span data-vu1="led" data-on="" aria-hidden />
        {copy("vu1.device.name")}
        <span data-vu1="dim">{copy("vu1.device.model")}</span>
      </span>
      <nav data-vu1="nav" data-vu1-cap="" aria-label={copy("vu1.top.nav_aria")}>
        {links.map(([page, label]) => (
          <a key={page} href={hrefs[page]} aria-current={active === page ? "page" : undefined}>
            <span data-vu1="led" data-on={active === page || undefined} aria-hidden />
            {label}
          </a>
        ))}
      </nav>
      <div data-vu1="tools" data-vu1-cap="">
        <a data-kit="button" data-tone="secondary" data-vu1="gh" href={githubHref} target="_blank" rel="noopener noreferrer">
          <LogoGithub size={16} aria-hidden />
          {copy("vu1.top.github")}
          {stars == null ? null : (
            <>
              <span data-vu1="star">{copy("vu1.top.star")}</span>
              <span>{stars}</span>
            </>
          )}
          <span className="sr-only">{copy("vu1.top.new_tab")}</span>
        </a>
        {signedIn ? (
          <Button onClick={onSignOut}>{copy("vu1.top.sign_out")}</Button>
        ) : (
          <Button tone="primary" onClick={onSignIn}>
            {copy("vu1.top.sign_in")}
          </Button>
        )}
        <Button round aria-label={copy("vu1.top.sound")} aria-pressed={sound} onClick={() => setSoundEnabled(!sound)}>
          <Icon name={sound ? "volume" : "volume-mute"} />
        </Button>
      </div>
    </header>
  );
}
