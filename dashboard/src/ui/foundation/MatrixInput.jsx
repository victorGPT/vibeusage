import { Input } from "@base-ui/react/input";
import React from "react";

export function MatrixInput({ label, className = "", ...props }) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="text-caption text-ink-text uppercase font-bold">{label}</span>
      <Input
        className="h-10 bg-surface-raised border border-ink-faint px-3 text-body text-ink-bright outline-none focus:border-ink focus:ring-2 focus:ring-ink"
        {...props}
      />
    </label>
  );
}
