import React from "react";

export function MatrixInput({ label, className = "", ...props }) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="text-[9px] opacity-50 uppercase tracking-widest font-black">
        {label}
      </span>
      <input
        className="h-[38px] bg-black/40 border border-[#00FF41]/20 px-3 text-[11px] text-[#00FF41] outline-none focus:border-[#00FF41] focus:ring-2 focus:ring-[#00FF41]/20"
        {...props}
      />
    </label>
  );
}

