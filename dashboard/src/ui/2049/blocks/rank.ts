import type { LeaderboardEntry, LeaderboardMe } from "./types";

// The rows around mine: up to n ranks above and n below, as far as `entries` reaches.
export function neighbours(entries: LeaderboardEntry[], meRank: number | null, n: number) {
  if (meRank == null) return { above: [], below: [] };
  const near = entries
    .filter((e) => e.rank !== meRank && Math.abs(e.rank - meRank) <= n)
    .sort((a, b) => a.rank - b.rank);
  return { above: near.filter((e) => e.rank < meRank), below: near.filter((e) => e.rank > meRank) };
}

// My row is pinned under the table whenever I am ranked but not on the page shown.
export function pinnedMe(entries: LeaderboardEntry[], me: LeaderboardMe | null) {
  if (me?.rank == null || entries.some((e) => e.rank === me.rank)) return null;
  return me;
}

// The entry one rank above mine, the one to pass.
export function ahead(entries: LeaderboardEntry[], me: LeaderboardMe | null) {
  if (me?.rank == null) return undefined;
  return entries.find((e) => e.rank === (me.rank as number) - 1);
}
