import { copy } from "#src/lib/copy.ts";
import { cn } from "#src/lib/utils.ts";
import { Label } from "#src/ui/2049/base/Label.tsx";
import { Badge } from "#src/ui/shadcn/badge.tsx";
import { Button } from "#src/ui/shadcn/button.tsx";
import { Card } from "#src/ui/shadcn/card.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#src/ui/shadcn/table.tsx";

import { abbr } from "./format";
import { Pager } from "./Pager";
import { pinnedMe } from "./rank";
import { displayName, periodLabel, rankText, you } from "./shared";
import type { LeaderboardEntry, LeaderboardMe, LeaderboardPeriod } from "./types";

type RankTableProps = {
  entries: LeaderboardEntry[];
  me: LeaderboardMe | null;
  handle: string;
  page: number;
  totalPages: number;
  totalEntries: number;
  period: LeaderboardPeriod;
  onPageChange: (page: number) => void;
  onJumpToMe?: () => void;
  profileHref?: (entry: LeaderboardEntry) => string | null;
};

type RowProps = {
  entry: LeaderboardMe;
  me: boolean;
  user: string;
  href?: string | null;
  pinned?: boolean;
};

function Row({ entry, me, user, href, pinned = false }: RowProps) {
  const lead = entry.rank === 1;
  const cell = cn(me && "text-primary", lead && "border-t-2 border-t-teal", pinned && "border-input");
  return (
    <TableRow className={cn(me && "bg-primary/8")}>
      <TableCell className={cn("font-display", me ? "text-primary" : "text-muted-foreground", cell)}>
        {rankText(entry.rank)}
      </TableCell>
      <TableCell className={cn("font-sans font-medium", me ? "text-primary" : "text-hero", cell)}>
        <span className="flex max-w-80 items-center gap-2">
          {href ? (
            <a href={href} className="truncate underline-offset-4 hover:underline">
              {user}
            </a>
          ) : (
            <span className="truncate">{user}</span>
          )}
          {lead ? <Badge variant="accent">{copy("ui2049.rank_row.leader")}</Badge> : null}
        </span>
      </TableCell>
      <TableCell className={cn("text-right", me ? "text-primary" : "text-hero", cell)}>
        {abbr(entry.total_tokens)}
      </TableCell>
      <TableCell className={cn("text-right", cell)}>{abbr(entry.gpt_tokens)}</TableCell>
      <TableCell className={cn("text-right", cell)}>{abbr(entry.claude_tokens)}</TableCell>
      <TableCell className={cn("text-right", cell)}>{abbr(entry.other_tokens)}</TableCell>
    </TableRow>
  );
}

// SSOT: design/2049/source/RankTable.dc.html. When I am ranked but off this page, my row is
// pinned under the table (the board pins it above the rows; the contract moved it down).
export function RankTable(props: RankTableProps) {
  const { entries, me, handle, page, totalPages, totalEntries, period, onPageChange, onJumpToMe, profileHref } = props;
  const kicker = copy("ui2049.rank_table.kicker", { period: periodLabel(period), count: totalEntries });
  const pinned = pinnedMe(entries, me);

  return (
    <Card role="region" aria-label={kicker} className="gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Label text={kicker} />
        {onJumpToMe && me?.rank != null ? (
          <div className="ml-auto">
            <Button variant="outline" onClick={onJumpToMe}>
              {copy("ui2049.rank_table.jump", { rank: me.rank })}
            </Button>
          </div>
        ) : null}
      </div>
      <Table className="min-w-170">
        <TableHeader>
          <TableRow>
            <TableHead className="w-22">{copy("ui2049.rank_table.rank")}</TableHead>
            <TableHead>{copy("ui2049.rank_table.user")}</TableHead>
            <TableHead className="text-right text-primary">{copy("daily.sort.total.label")}</TableHead>
            <TableHead className="text-right">{copy("leaderboard.metric.gpt")}</TableHead>
            <TableHead className="text-right">{copy("ui2049.leaderboard_filters.claude")}</TableHead>
            <TableHead className="text-right">{copy("ui2049.rank_table.other")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <Row
              key={entry.rank}
              entry={entry}
              me={Boolean(entry.is_me)}
              user={entry.is_me ? you(handle) : displayName(entry)}
              href={entry.is_me ? null : profileHref?.(entry)}
            />
          ))}
        </TableBody>
        {pinned ? (
          <tfoot>
            <Row entry={pinned} me user={you(handle)} pinned />
          </tfoot>
        ) : null}
      </Table>
      <Pager
        summary={copy("ui2049.rank_table.page", { page, total: totalPages })}
        page={page}
        pageCount={totalPages}
        onPageChange={onPageChange}
      />
    </Card>
  );
}
