import type { CSSProperties } from "react";

import { copy } from "#src/lib/copy.ts";

import { abbr, num } from "./format";
import { KeyTip } from "./KeyTip";
import { pinnedMe } from "./rank";
import type { LeaderboardEntry, LeaderboardMe } from "./types";
import "./blocks.css";

type Row = { entry: LeaderboardMe; me: boolean };

function topCli(entry: LeaderboardMe) {
  const channels = [
    [num(entry.gpt_tokens), copy("vu1.rank.cli_gpt")],
    [num(entry.claude_tokens), copy("vu1.rank.cli_claude")],
    [num(entry.other_tokens), copy("vu1.rank.cli_other")],
  ] as const;
  const best = channels.reduce((top, channel) => (channel[0] > top[0] ? channel : top));
  return best[0] > 0 ? best[1] : copy("shared.placeholder.short");
}

// My row is red where it falls; when I am ranked but off this page it is pinned on top.
export function RankScreen({ entries, me, handle, frame }: { entries: LeaderboardEntry[]; me: LeaderboardMe | null; handle: string; frame?: "single" }) {
  const pinned = pinnedMe(entries, me);
  const rows: Row[] = [
    ...(pinned ? [{ entry: pinned, me: true }] : []),
    ...entries.map((entry) => ({ entry, me: Boolean(entry.is_me) })),
  ];
  let max = 1;
  for (const row of rows) {
    max = Math.max(max, num(row.entry.total_tokens));
  }
  return (
    <div data-vu1="lcd" data-frame={frame}>
      <table data-vu1="list" data-vu1-cap="" aria-label={copy("vu1.rank.aria")}>
        <thead>
          <tr>
            <th scope="col" data-num="">
              {copy("vu1.rank.rank")}
            </th>
            <th scope="col">{copy("vu1.rank.handle")}</th>
            <th scope="col" data-minor="">
              {copy("vu1.rank.top_cli")}
            </th>
            <th scope="col" data-num="">
              {copy("vu1.rank.tokens")}
            </th>
            <th scope="col">
              <KeyTip label={copy("vu1.rank.load_hint")}>
                <span tabIndex={0} data-vu1="hint">
                  {copy("vu1.rank.load")}
                </span>
              </KeyTip>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ entry, me: mine }, i) => (
            <tr key={entry.user_id ?? `${entry.rank}-${i}`} data-me={mine || undefined}>
              <td data-num="">{entry.rank ?? copy("shared.placeholder.short")}</td>
              <td data-name="">{mine ? handle : (entry.display_name ?? copy("shared.placeholder.short"))}</td>
              <td data-minor="">{topCli(entry)}</td>
              <td data-num="">{abbr(entry.total_tokens)}</td>
              <td data-fill="">
                <span data-vu1="meter" aria-hidden style={{ "--share": num(entry.total_tokens) / max } as CSSProperties} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
