import { copy } from "#src/lib/copy.ts";
import { Label } from "#src/ui/2049/base/Label.tsx";
import { RankRow } from "#src/ui/2049/base/RankRow.tsx";
import { Card } from "#src/ui/shadcn/card.tsx";

import { abbr } from "./format";
import { Linked } from "./Linked";
import { displayName, periodLabel, rankText, you } from "./shared";
import type { LeaderboardEntry, LeaderboardPeriod } from "./types";

type RankListProps = {
  entries: LeaderboardEntry[];
  period: LeaderboardPeriod;
  handle: string;
  profileHref?: (entry: LeaderboardEntry) => string | null;
};

// SSOT: design/2049/source/RankList.dc.html. RankRow takes the user as text, so a profile link
// wraps the whole row.
export function RankList({ entries, period, handle, profileHref }: RankListProps) {
  const title = copy("ui2049.rank_list.title", { period: periodLabel(period) });
  return (
    <Card role="region" aria-label={title} className="min-h-128 gap-3">
      <Label text={title} />
      <div className="flex flex-col">
        {entries.slice(0, 10).map((entry) => (
          <Linked key={entry.rank} href={entry.is_me ? null : profileHref?.(entry)} className="hover:bg-card">
            <RankRow
              rank={rankText(entry.rank)}
              user={entry.is_me ? you(handle) : displayName(entry)}
              value={abbr(entry.total_tokens)}
              me={entry.is_me}
              lead={entry.rank === 1}
            />
          </Linked>
        ))}
      </div>
    </Card>
  );
}
