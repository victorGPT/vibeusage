import React from "react";
import { copy } from "../../../lib/copy";

export function SystemHeader({
  title = copy("system.header.title_default"),
  signalLabel,
  time,
  className = "",
}) {
  return (
    <header
      className={`flex justify-between border-b border-ink-faint p-4 items-center shrink-0 bg-surface-raised ${className}`}
    >
      <div className="flex items-center space-x-4">
        <div className="bg-ink text-surface px-2 py-1 font-black text-heading uppercase skew-x-[-10deg] border border-ink shadow-glow-sm">
          {title}
        </div>
        {signalLabel ? (
          <span className="text-caption text-ink-text hidden sm:inline font-bold uppercase animate-pulse">
            {signalLabel}
          </span>
        ) : null}
      </div>
      {time ? (
        <div className="text-ink font-bold text-body tracking-caps">{time}</div>
      ) : null}
    </header>
  );
}
