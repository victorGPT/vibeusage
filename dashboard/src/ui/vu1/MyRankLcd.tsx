import { copy } from "#src/lib/copy.ts";

import { abbr, num } from "./format";
import { ahead } from "./rank";
import type { LeaderboardEntry, LeaderboardMe } from "./types";
import "./blocks.css";

export function MyRankLcd({ me, entries }: { me: LeaderboardMe | null; entries: LeaderboardEntry[] }) {
  const next = ahead(entries, me);
  return (
    <section data-vu1="screen" data-variant="row" data-vu1-cap="" aria-label={copy("vu1.myrank.aria")}>
      <span className="flex gap-s2">
        <span data-vu1="dim">{copy("vu1.myrank.you")}</span>
        <span data-vu1="red">{me?.rank == null ? copy("shared.placeholder.short") : `#${me.rank}`}</span>
      </span>
      {next && me ? (
        <span className="flex gap-s2">
          <span data-vu1="dim">{copy("vu1.myrank.gap", { rank: next.rank })}</span>
          <span>{abbr(num(next.total_tokens) - num(me.total_tokens))}</span>
        </span>
      ) : null}
    </section>
  );
}
