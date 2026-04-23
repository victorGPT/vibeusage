import React from "react";
import { CLIENTS } from "./ClientLogos.jsx";

export function ClientLogoRow({ className = "" }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-3 ${className}`}>
      {CLIENTS.map(({ id, name, Icon }) => (
        <div
          key={id}
          className="flex items-center gap-1.5 px-2 py-1 rounded border border-ink-faint bg-surface-raised/50"
          title={name}
        >
          <Icon className="w-4 h-4 text-ink" />
          <span className="text-caption text-ink-bright">{name}</span>
        </div>
      ))}
    </div>
  );
}

export default ClientLogoRow;
