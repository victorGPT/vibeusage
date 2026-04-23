import React from "react";

export function DataRow({ label, value, subValue, valueClassName = "" }) {
  return (
    <div className="flex justify-between items-center border-b border-ink-faint py-2 group hover:bg-surface-raised transition-colors px-2">
      <span className="text-caption text-ink-text uppercase font-bold leading-none">
        {label}
      </span>
      <div className="flex items-center space-x-3">
        {subValue ? <span className="text-caption text-ink-muted italic">{subValue}</span> : null}
        <span className={`font-black tracking-tight text-body ${valueClassName}`}>{value}</span>
      </div>
    </div>
  );
}
