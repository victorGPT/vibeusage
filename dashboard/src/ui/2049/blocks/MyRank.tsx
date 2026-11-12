import { copy } from "#src/lib/copy.ts";
import { cn } from "#src/lib/utils.ts";
import { Delta } from "#src/ui/2049/base/Delta.tsx";
import { Display } from "#src/ui/2049/base/Display.tsx";
import { Heading } from "#src/ui/2049/base/Heading.tsx";
import { Label } from "#src/ui/2049/base/Label.tsx";
import { RankRow } from "#src/ui/2049/base/RankRow.tsx";
import { ScreenFx } from "#src/ui/2049/base/ScreenFx.tsx";
import { Stamp } from "#src/ui/2049/base/Stamp.tsx";
import { Stat } from "#src/ui/2049/base/Stat.tsx";

import { abbr, num, range } from "./format";
import { ahead, counted, neighbours } from "./rank";
import { displayName, periodLabel, rankText, SCREEN_FILL, you } from "./shared";
import type { LeaderboardEntry, LeaderboardMe, LeaderboardMetric, LeaderboardPeriod } from "./types";

type MyRankProps = {
  me: LeaderboardMe | null;
  entries: LeaderboardEntry[];
  totalEntries: number;
  period: LeaderboardPeriod;
  metric?: LeaderboardMetric;
  from: string;
  to: string;
  handle: string;
};

function Neighbour({ entry, metric }: { entry: LeaderboardEntry; metric: LeaderboardMetric }) {
  return <RankRow rank={rankText(entry.rank)} user={displayName(entry)} value={abbr(counted(entry, metric))} />;
}

// SSOT: design/2049/source/MyRank.dc.html. Up to three neighbours on each side fill the screen
// to the height of the RankList beside it.
export function MyRank({ me, entries, totalEntries, period, metric = "all", from, to, handle }: MyRankProps) {
  const label = periodLabel(period);
  const kicker =
    metric === "all"
      ? copy("ui2049.my_rank.kicker", { period: label })
      : copy("ui2049.my_rank.kicker_metric", { period: label, metric: copy(`leaderboard.metric.${metric}`) });
  const next = ahead(entries, me);
  const { above, below } = neighbours(entries, me?.rank ?? null, 3);
  return (
    <section aria-label={kicker}>
      <ScreenFx className={cn("min-h-128", SCREEN_FILL)}>
        <div className="flex flex-auto flex-col gap-4">
          <Label text={kicker} />
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <div className="flex items-baseline gap-3">
              <Display text={rankText(me?.rank)} size={88} tone="amber" />
              {me?.delta === undefined ? null : <Delta value={me.delta} />}
            </div>
            <div className="flex min-w-0 flex-col gap-2 pb-2">
              <Heading text={handle} size="xs" level={2} />
              <Label text={copy("ui2049.my_rank.of_ranked", { count: totalEntries })} />
            </div>
            <div className="ml-auto grid grid-cols-2 gap-x-4">
              <Stat label={copy("ui2049.my_rank.tokens")} value={abbr(me && counted(me, metric))} />
              {next && me ? (
                <Stat
                  label={copy("ui2049.my_rank.to_pass", { rank: next.rank })}
                  value={`+${abbr(num(counted(next, metric)) - num(counted(me, metric)))}`}
                  divider
                />
              ) : null}
            </div>
          </div>
          <div className="flex flex-col border-t border-border">
            {above.map((entry) => (
              <Neighbour key={entry.user_id ?? entry.rank} entry={entry} metric={metric} />
            ))}
            {me?.rank == null ? null : (
              <RankRow rank={rankText(me.rank)} user={you(handle)} value={abbr(counted(me, metric))} me />
            )}
            {below.map((entry) => (
              <Neighbour key={entry.user_id ?? entry.rank} entry={entry} metric={metric} />
            ))}
          </div>
          <Stamp handle={handle} range={`${label} · ${range(from, to)}`} />
        </div>
      </ScreenFx>
    </section>
  );
}
