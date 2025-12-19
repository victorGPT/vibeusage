import React from "react";

import { MatrixAvatar } from "./MatrixAvatar.jsx";

function formatRank(rank) {
  const raw = Number(rank);
  if (!Number.isFinite(raw)) return "--";
  return String(Math.max(0, raw)).padStart(2, "0");
}

function formatValue(value) {
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "bigint") return value.toLocaleString();
  if (value == null) return "--";
  return String(value);
}

export function LeaderboardRow({
  rank,
  name,
  value,
  isAnon = false,
  isSelf = false,
  isTheOne,
  className = "",
}) {
  const highlight = isSelf ? "bg-[#00FF41]/20 border-l-2 border-l-[#00FF41]" : "";
  const rankValue = Number(rank);
  const showGold = Boolean(isTheOne ?? rankValue === 1);

  return (
    <div
      className={`flex justify-between items-center py-2 px-2 border-b border-[#00FF41]/10 hover:bg-[#00FF41]/5 group ${highlight} ${className}`}
    >
      <div className="flex items-center space-x-3">
        <span
          className={`font-mono text-[9px] w-6 ${
            rankValue <= 3 ? "text-[#00FF41] font-bold" : "opacity-40"
          }`}
        >
          {formatRank(rank)}
        </span>
        <MatrixAvatar name={name} isAnon={isAnon} isTheOne={showGold} size={24} />
        <span
          className={`text-[10px] uppercase font-bold tracking-tight ${
            isAnon ? "opacity-30 blur-[1px]" : "text-white"
          }`}
        >
          {name}
        </span>
      </div>
      <span className="font-mono text-[10px] text-[#00FF41]">
        {formatValue(value)}
      </span>
    </div>
  );
}
