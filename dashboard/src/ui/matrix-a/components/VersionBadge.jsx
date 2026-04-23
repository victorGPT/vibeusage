import React from "react";
import { copy } from "../../../lib/copy";

export function VersionBadge({ version }) {
  const value = typeof version === "string" ? version.trim() : "";
  if (!value) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-surface-raised border border-ink-faint px-3 py-2 shadow-glow-faint">
      <div className="text-caption text-ink-text uppercase font-bold">
        {copy("dashboard.version.label")}
      </div>
      <div className="text-body text-ink-bright font-black tracking-tight">{value}</div>
    </div>
  );
}
