import React, { useMemo } from "react";

function toHandle(auth) {
  const raw = (auth?.name || auth?.email || "Anonymous").trim();
  const base = raw.includes("@") ? raw.split("@")[0] : raw;
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function IdentityPanel({ auth, streakDays = 0, rankLabel = "—" }) {
  const handle = useMemo(() => toHandle(auth), [auth]);
  const email = auth?.email || null;
  const userId = auth?.userId || null;

  return (
    <div className="flex items-center space-x-6">
      <div className="relative group">
        <div className="w-20 h-20 border border-[#00FF41]/30 flex items-center justify-center text-3xl font-black bg-[#00FF41]/5 shadow-[0_0_15px_rgba(0,255,65,0.1)]">
          VS
        </div>
        <div className="absolute -bottom-1 -right-1 bg-white text-black text-[8px] px-1 font-black uppercase">
          Lvl_05
        </div>
      </div>

      <div className="space-y-3 flex-1 min-w-0">
        <div className="border-l-2 border-[#00FF41] pl-3 py-1 bg-[#00FF41]/5">
          <div className="text-[8px] opacity-40 uppercase font-black mb-1 tracking-tighter">
            Access_Handle
          </div>
          <div className="text-white font-black text-lg tracking-tight leading-none uppercase truncate">
            {handle}
          </div>
          {email ? (
            <div className="text-[9px] opacity-40 mt-1 truncate">{email}</div>
          ) : null}
          {userId ? (
            <div className="text-[9px] opacity-25 mt-1 font-mono truncate">
              {userId}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#00FF41]/5 p-1 border border-[#00FF41]/10 text-center">
            <div className="text-[7px] opacity-40 uppercase font-black">Rank</div>
            <div className="text-[#00FF41] font-black underline underline-offset-2">
              {rankLabel}
            </div>
          </div>
          <div className="bg-[#00FF41]/5 p-1 border border-[#00FF41]/10 text-center">
            <div className="text-[7px] opacity-40 uppercase font-black">
              Streak
            </div>
            <div className="text-yellow-400 font-black tracking-tighter">
              {streakDays}_DAYS
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

