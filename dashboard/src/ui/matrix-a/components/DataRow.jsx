import React from "react";

export function DataRow({ label, value, subValue, valueClassName = "" }) {
  return (
    <div className="flex justify-between items-center border-b border-[#00FF41]/5 py-1.5 group hover:bg-[#00FF41]/5 transition-colors px-1">
      <span className="opacity-40 uppercase text-[8px] font-black tracking-widest leading-none">
        {label}
      </span>
      <div className="flex items-center space-x-3">
        {subValue ? (
          <span className="text-[8px] opacity-20 italic font-mono">{subValue}</span>
        ) : null}
        <span className={`font-black tracking-tight text-[11px] ${valueClassName}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

