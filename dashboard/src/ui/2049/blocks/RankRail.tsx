import { copy } from "#src/lib/copy.ts";
import { Delta } from "#src/ui/2049/base/Delta.tsx";
import { Display } from "#src/ui/2049/base/Display.tsx";
import { Label } from "#src/ui/2049/base/Label.tsx";
import { Stamp } from "#src/ui/2049/base/Stamp.tsx";
import { Stat } from "#src/ui/2049/base/Stat.tsx";
import { Button } from "#src/ui/shadcn/button.tsx";
import { Card } from "#src/ui/shadcn/card.tsx";

import { abbr, num, range } from "./format";
import { ahead } from "./rank";
import { displayName, rankText } from "./shared";
import type { LeaderboardEntry, LeaderboardMe } from "./types";

type RankRailProps = {
  me: LeaderboardMe | null;
  entries: LeaderboardEntry[];
  totalEntries: number;
  from: string;
  to: string;
  handle: string;
  leaderboardHref: string;
};

// SSOT: design/2049/source/RankRail.dc.html. h-full so it matches the Readout in a stretch row.
export function RankRail({ me, entries, totalEntries, from, to, handle, leaderboardHref }: RankRailProps) {
  const title = copy("ui2049.rank_rail.title");
  const next = ahead(entries, me);
  return (
    <Card role="region" aria-label={title} className="h-full">
      <div className="flex items-center gap-3">
        <Label text={title} />
        <div className="ml-auto">
          <Button variant="outline" nativeButton={false} render={<a href={leaderboardHref} />}>
            {copy("leaderboard.title")}
          </Button>
        </div>
      </div>
      <div className="flex items-baseline gap-3">
        <Display text={rankText(me?.rank)} size={72} tone="amber" glow={false} />
        {me?.delta === undefined ? null : <Delta value={me.delta} suffix={copy("ui2049.rank_rail.delta_suffix")} />}
      </div>
      {next && me ? (
        <div className="border-t border-border pt-4">
          <Stat
            label={copy("ui2049.rank_rail.to_pass", { rank: next.rank, name: displayName(next) })}
            value={`+${abbr(num(next.total_tokens) - num(me.total_tokens))}`}
          />
        </div>
      ) : null}
      <div className="border-t border-border pt-4">
        <Stat
          label={copy("ui2049.rank_rail.this_week")}
          value={copy("ui2049.rank_rail.this_week_value", { value: abbr(me?.total_tokens), count: totalEntries })}
          size="S"
        />
      </div>
      <Stamp handle={handle} range={range(from, to, "short")} />
    </Card>
  );
}
