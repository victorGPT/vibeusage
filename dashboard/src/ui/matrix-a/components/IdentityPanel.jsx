import React, { useMemo } from "react";
import { copy } from "../../../lib/copy";

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
        <div className="w-20 h-20 border border-ink-faint flex items-center justify-center text-body font-black bg-surface-raised shadow-glow-faint">
          {copy("identity_panel.badge")}
        </div>
        <div className="absolute -bottom-1 -right-1 bg-ink-bright text-surface text-caption px-1 font-black uppercase">
          {copy("identity_panel.level")}
        </div>
      </div>

      <div className="space-y-3 flex-1 min-w-0">
        <div className="border-l-2 border-ink pl-3 py-2 bg-surface-raised">
          <div className="text-display-3 md:text-display-3 font-black text-ink-bright tracking-tight leading-none uppercase truncate">
            {handle}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-surface-raised p-2 border border-ink-faint text-center">
            <div className="text-caption text-ink-text uppercase font-bold">
              {copy("identity_panel.rank_label")}
            </div>
            <div className="text-ink font-black text-body">{rankValue}</div>
          </div>
          <div className="bg-surface-raised p-2 border border-ink-faint text-center">
            <div className="text-caption text-ink-text uppercase font-bold">
              {copy("identity_panel.streak_label")}
            </div>
            <div className="text-gold font-black tracking-tight text-body">{streakValue}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
