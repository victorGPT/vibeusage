import { copy } from "#src/lib/copy.ts";
import { cn } from "#src/lib/utils.ts";
import { Badge } from "#src/ui/shadcn/badge.tsx";

import { Delta } from "./Delta";

type RankRowProps = {
  rank: string;
  user: string;
  value: string;
  delta?: number;
  me?: boolean;
  lead?: boolean;
};

// SSOT: design/2049/source/RankRow.dc.html. "Me" turns the whole row amber; the leader gets a
// teal top rule and a badge. Both can hold at once.
export function RankRow({ rank, user, value, delta, me = false, lead = false }: RankRowProps) {
  return (
    <div
      className={cn(
        "flex min-h-row items-center gap-3 border-b border-border px-3 font-sans",
        me && "bg-primary/8",
        lead && "border-t border-t-teal",
      )}
    >
      <span
        className={cn(
          "w-10 font-display text-value-s/none tabular-nums",
          me ? "text-primary" : "text-muted-foreground",
        )}
      >
        {rank}
      </span>
      <span
        className={cn(
          "flex min-w-0 flex-auto items-center gap-2 text-copy-m/none font-medium",
          me ? "text-primary" : "text-hero",
        )}
      >
        <span className="truncate">{user}</span>
        {lead ? <Badge variant="accent">{copy("ui2049.rank_row.leader")}</Badge> : null}
      </span>
      {delta === undefined ? null : (
        <span className="w-11 text-right">
          <Delta value={delta} />
        </span>
      )}
      <span
        className={cn(
          "w-18 text-right font-display text-value-s/none tabular-nums",
          me ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
