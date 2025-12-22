import React, { useMemo } from "react";

import { copy } from "../../../lib/copy.js";

function toHandle(auth) {
  const raw = auth?.name?.trim();
  const safe = raw && !raw.includes("@") ? raw : copy("dashboard.identity.fallback");
  return safe.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function IdentityPanel({ auth, streakDays = 0, rankLabel }) {
  const handle = useMemo(() => toHandle(auth), [auth]);
  const rankValue = rankLabel ?? copy("identity_panel.rank_placeholder");
  const streakValue = Number.isFinite(Number(streakDays))
    ? copy("identity_panel.streak_value", { days: Number(streakDays) })
    : copy("identity_panel.rank_placeholder");

  return (
    <div className="flex items-center space-x-6">
      <div className="relative group">
        <div className="w-20 h-20 border border-[#00FF41]/30 flex items-center justify-center text-3xl font-black bg-[#00FF41]/5 shadow-[0_0_15px_rgba(0,255,65,0.1)]">
          {copy("identity_panel.badge")}
        </div>
        <div className="absolute -bottom-1 -right-1 bg-white text-black text-[8px] px-1 font-black uppercase">
          {copy("identity_panel.level")}
        </div>
      </div>

      <div className="space-y-3 flex-1 min-w-0">
        <div className="border-l-2 border-[#00FF41] pl-3 py-1 bg-[#00FF41]/5">
          <div className="text-[8px] opacity-40 uppercase font-black mb-1 tracking-tighter">
            {copy("identity_panel.access_label")}
          </div>
          <div className="text-white font-black text-lg tracking-tight leading-none uppercase truncate">
            {handle}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#00FF41]/5 p-1 border border-[#00FF41]/10 text-center">
            <div className="text-[7px] opacity-40 uppercase font-black">
              {copy("identity_panel.rank_label")}
            </div>
            <div className="text-[#00FF41] font-black underline underline-offset-2">
              {rankValue}
            </div>
          </div>
          <div className="bg-[#00FF41]/5 p-1 border border-[#00FF41]/10 text-center">
            <div className="text-[7px] opacity-40 uppercase font-black">
              {copy("identity_panel.streak_label")}
            </div>
            <div className="text-yellow-400 font-black tracking-tighter">
              {streakValue}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
