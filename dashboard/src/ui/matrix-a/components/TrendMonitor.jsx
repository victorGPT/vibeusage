import React, { useMemo } from "react";

const DEFAULT_COLOR = "#00FF41";
const GRID_SIZE = 20;

function parseDate(value) {
  if (!value) return null;
  const parts = String(value).trim().split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(Date.UTC(y, m, d));
}

function formatAxisDate(dt) {
  if (!dt) return "";
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

function buildXAxisLabels({ from, to }) {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end || end < start) {
    return ["-24H", "-18H", "-12H", "-6H", "NOW"];
  }
  const totalMs = end.getTime() - start.getTime();
  const steps = [0, 0.25, 0.5, 0.75, 1];
  return steps.map((ratio, idx) => {
    if (idx === steps.length - 1) return "NOW";
    const dt = new Date(start.getTime() + totalMs * ratio);
    return formatAxisDate(dt);
  });
}

export function TrendMonitor({
  data = [],
  color = DEFAULT_COLOR,
  label = "TREND",
  from,
  to,
  className = "",
}) {
  const hasData = Array.isArray(data) && data.length > 0;
  const safeData = hasData ? data : Array.from({ length: 24 }, () => 0);
  const max = Math.max(...safeData, 100);
  const avg = safeData.reduce((a, b) => a + b, 0) / safeData.length;

  const points = useMemo(() => {
    if (safeData.length <= 1) return "";
    return safeData
      .map((val, i) => {
        const x = (i / (safeData.length - 1)) * 100;
        const normalizedVal = max > 0 ? val / max : 0;
        const y = 100 - normalizedVal * 100;
        return `${x},${y}`;
      })
      .join(" ");
  }, [safeData, max]);

  const fillPath = points ? `${points} 100,100 0,100` : "";
  const xLabels = useMemo(() => buildXAxisLabels({ from, to }), [from, to]);

  return (
    <div
      className={`w-full h-full min-h-[160px] flex flex-col relative group select-none bg-[#050505] border border-white/10 p-1 ${className}`}
    >
      <div className="flex justify-between items-center px-1 mb-1 border-b border-white/5 pb-1">
        <span className="text-[9px] font-black uppercase tracking-widest text-[#00FF41]/80 flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 bg-[#00FF41] animate-pulse shadow-[0_0_5px_#00FF41]"
          ></span>
          {label}
        </span>
        <div className="flex gap-3 text-[8px] font-mono text-[#00FF41]/50">
          <span>MAX: {Math.round(max)}</span>
          <span>AVG: {Math.round(avg)}</span>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden border border-white/5 bg-black/40">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, ${color} 1px, transparent 1px),
              linear-gradient(to bottom, ${color} 1px, transparent 1px)
            `,
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00FF41]/10 to-transparent w-[50%] h-full animate-[scan-x_3s_linear_infinite] pointer-events-none mix-blend-screen" />

        <svg
          viewBox="0 0 100 100"
          className="w-full h-full preserve-3d absolute inset-0 z-10"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.5" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
            <mask id={`grid-mask-${label}`}>
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <path
                d="M0 20 H100 M0 40 H100 M0 60 H100 M0 80 H100"
                stroke="black"
                strokeWidth="0.5"
              />
            </mask>
          </defs>

          {fillPath ? (
            <path
              d={`M${fillPath} Z`}
              fill={`url(#grad-${label})`}
              mask={`url(#grid-mask-${label})`}
            />
          ) : null}
          {points ? (
            <polyline
              points={points}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
              className="drop-shadow-[0_0_5px_rgba(0,255,65,0.8)]"
            />
          ) : null}
        </svg>

        <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-between py-1 px-1 text-[7px] font-mono text-[#00FF41]/60 pointer-events-none bg-black/60 backdrop-blur-[1px] border-l border-white/5 w-8 text-right">
          <span>{Math.round(max)}k</span>
          <span>{Math.round(max * 0.75)}k</span>
          <span>{Math.round(max * 0.5)}k</span>
          <span>{Math.round(max * 0.25)}k</span>
          <span>0</span>
        </div>

        {!hasData ? (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] opacity-40">
            No signal data.
          </div>
        ) : null}
      </div>

      <div className="h-4 flex justify-between items-center px-1 mt-1 text-[8px] font-mono text-[#00FF41]/40 border-t border-white/5 pt-1">
        {xLabels.map((labelText, idx) => (
          <span
            key={`${labelText}-${idx}`}
            className={labelText === "NOW" ? "text-[#00FF41] font-bold animate-pulse" : ""}
          >
            {labelText}
          </span>
        ))}
      </div>
    </div>
  );
}
