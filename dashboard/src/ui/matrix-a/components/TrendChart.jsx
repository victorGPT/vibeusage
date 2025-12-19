import React from "react";

export function TrendChart({
  data,
  unitLabel = "TKNS",
  leftLabel = "T-24H",
  rightLabel = "Realtime_Flow",
}) {
  const values = Array.isArray(data) ? data.map((n) => Number(n) || 0) : [];
  const max = Math.max(...values, 1);

  if (!values.length) {
    return <div className="text-[10px] opacity-40">No trend data.</div>;
  }

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-end h-24 space-x-1 border-b border-[#00FF41]/20 pb-1 relative">
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
          <div className="border-t border-[#00FF41] w-full"></div>
          <div className="border-t border-[#00FF41] w-full"></div>
          <div className="border-t border-[#00FF41] w-full"></div>
        </div>
        {values.map((val, i) => (
          <div key={i} className="flex-1 bg-[#00FF41]/5 relative group">
            <div
              style={{ height: `${(val / max) * 100}%` }}
              className="w-full bg-[#00FF41] opacity-50 group-hover:opacity-100 group-hover:bg-white transition-all duration-300 shadow-[0_0_10px_rgba(0,255,65,0.2)]"
            ></div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[7px] opacity-30 font-black uppercase tracking-[0.2em]">
        <span>{leftLabel}</span>
        <span>
          Peak: {max.toLocaleString()} {unitLabel}
        </span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

