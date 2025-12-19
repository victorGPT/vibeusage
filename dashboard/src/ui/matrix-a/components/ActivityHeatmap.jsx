import React from "react";

const OPACITY_BY_LEVEL = [0.15, 0.45, 0.62, 0.8, 1];

function formatTokenValue(value) {
  if (typeof value === "bigint") return value.toLocaleString();
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value).toLocaleString() : "0";
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (/^[0-9]+$/.test(s)) {
      try {
        return BigInt(s).toLocaleString();
      } catch (_e) {}
    }
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n).toLocaleString() : s;
  }
  return "0";
}

export function ActivityHeatmap({ heatmap }) {
  const weeks = heatmap?.weeks || [];

  if (!weeks.length) {
    return (
      <div className="text-[10px] opacity-40 font-mono">
        No activity data yet.
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto no-scrollbar py-1">
        <div className="flex space-x-1.5 min-w-fit">
          {weeks.map((week, wIdx) => (
            <div
              key={wIdx}
              className="flex flex-col space-y-0.5 border-r border-[#00FF41]/10 pr-1.5 last:border-none"
            >
              {(Array.isArray(week) ? week : []).map((cell, dIdx) => {
                if (!cell) {
                  return (
                    <span
                      key={dIdx}
                      className="text-[9px] leading-none text-transparent select-none"
                      aria-hidden="true"
                    >
                      ·
                    </span>
                  );
                }

                const level = Number(cell.level) || 0;
                const opacity = OPACITY_BY_LEVEL[level] ?? 0.3;
                const char = level === 0 ? "·" : "■";
                const className =
                  level === 0
                    ? "text-[#00FF41]/10"
                    : "text-[#00FF41] shadow-glow";

                return (
                  <span
                    key={dIdx}
                    className={`text-[9px] leading-none transition-all duration-700 ${className}`}
                    style={{ opacity }}
                    title={`${cell.day} • ${formatTokenValue(cell.value)} tokens`}
                  >
                    {char}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center mt-3 text-[7px] border-t border-[#00FF41]/5 pt-2 opacity-40 font-black uppercase tracking-widest">
        <div className="flex space-x-3 items-center">
          <span>Density_Scale:</span>
          <div className="flex gap-1.5 font-mono">
            <span className="opacity-20 text-[10px]">·</span>
            <span className="opacity-40 text-[10px]">■</span>
            <span className="opacity-60 text-[10px]">■</span>
            <span className="opacity-80 text-[10px]">■</span>
            <span className="opacity-100 text-[10px] shadow-glow">■</span>
          </div>
        </div>
        <span>UTC</span>
      </div>
    </div>
  );
}
