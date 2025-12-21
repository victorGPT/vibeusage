import React, { useMemo, useRef, useState } from "react";

// --- Trend Monitor (NeuralFluxMonitor v2.0) ---
// Industrial TUI style: independent axes, precise grid, physical partitions.
export function TrendMonitor({
  rows,
  data = [],
  color = "#00FF41",
  label = "TREND",
  from,
  to,
  period,
}) {
  const series = Array.isArray(rows) && rows.length ? rows : null;
  const seriesValues = series
    ? series.map((row) => Number(row?.total_tokens || 0))
    : [];
  const seriesLabels = series ? series.map((row) => row?.day || "") : [];
  const safeData =
    seriesValues.length > 0
      ? seriesValues
      : data.length > 0
      ? data
      : Array.from({ length: 24 }, () => 0);
  const max = Math.max(...safeData, 100);
  const avg = safeData.reduce((a, b) => a + b, 0) / safeData.length;

  const width = 100;
  const height = 100;
  const axisWidth = 8;
  const plotWidth = width - axisWidth;
  const plotTop = 4;
  const plotBottom = 4;
  const plotHeight = height - plotTop - plotBottom;

  function parseDate(value) {
    if (!value) return null;
    const parts = String(value).trim().split("-");
    if (parts.length !== 3) return null;
    const y = Number(parts[0]);
    const m = Number(parts[1]) - 1;
    const d = Number(parts[2]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
      return null;
    }
    return new Date(Date.UTC(y, m, d));
  }

  function formatAxisDate(dt) {
    if (!dt) return "";
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${mm}-${dd}`;
  }

  const MONTH_LABELS = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];

  function formatMonth(dt) {
    if (!dt) return "";
    const yy = String(dt.getUTCFullYear()).slice(-2);
    return `${MONTH_LABELS[dt.getUTCMonth()]} ${yy}`;
  }

  function buildXAxisLabels() {
    if (period === "day") {
      return ["00:00", "06:00", "12:00", "18:00", "NOW"];
    }
    const start = parseDate(from);
    const end = parseDate(to);
    if (!start || !end || end < start) {
      return ["-24H", "-18H", "-12H", "-6H", "NOW"];
    }
    const totalMs = end.getTime() - start.getTime();
    const steps = [0, 0.25, 0.5, 0.75, 1];
    if (period === "total") {
      return steps.map((ratio) =>
        formatMonth(new Date(start.getTime() + totalMs * ratio))
      );
    }
    return steps.map((ratio) =>
      formatAxisDate(new Date(start.getTime() + totalMs * ratio))
    );
  }

  function formatCompact(value) {
    const n = Number(value) || 0;
    const abs = Math.abs(n);
    if (abs >= 1e9) {
      const fixed = abs >= 1e10 ? 0 : 1;
      return `${(n / 1e9).toFixed(fixed)}B`;
    }
    if (abs >= 1e6) {
      const fixed = abs >= 1e7 ? 0 : 1;
      return `${(n / 1e6).toFixed(fixed)}M`;
    }
    if (abs >= 1e3) {
      const fixed = abs >= 1e4 ? 0 : 1;
      return `${(n / 1e3).toFixed(fixed)}K`;
    }
    return String(Math.round(n));
  }

  function formatFull(value) {
    const n = Number(value) || 0;
    return n.toLocaleString();
  }

  const points = useMemo(() => {
    const denom = Math.max(safeData.length - 1, 1);
    return safeData
      .map((val, i) => {
        const x = (i / denom) * plotWidth;
        const normalizedVal = max > 0 ? val / max : 0;
        const y = plotTop + (1 - normalizedVal) * plotHeight;
        return `${x},${y}`;
      })
      .join(" ");
  }, [safeData, max]);

  const fillPath = `${points} ${plotWidth},${height - plotBottom} 0,${
    height - plotBottom
  }`;
  const xLabels = useMemo(() => buildXAxisLabels(), [from, period, to]);

  const plotRef = useRef(null);
  const [hover, setHover] = useState(null);

  function handleMove(e) {
    const el = plotRef.current;
    if (!el || safeData.length === 0) return;
    const rect = el.getBoundingClientRect();
    const axisWidthPx = (axisWidth / width) * rect.width;
    const plotWidthPx = rect.width - axisWidthPx;
    const rawX = Math.min(Math.max(e.clientX - rect.left, 0), plotWidthPx);
    const denom = Math.max(safeData.length - 1, 1);
    const ratio = plotWidthPx > 0 ? rawX / plotWidthPx : 0;
    const index = Math.round(ratio * denom);
    const value = safeData[index] ?? 0;
    const snappedX =
      denom > 0 ? (index / denom) * plotWidthPx : plotWidthPx / 2;
    const labelText = seriesLabels[index] || "";
    const yRatio = max > 0 ? 1 - value / max : 1;
    const yPx =
      (plotTop / height) * rect.height +
      yRatio * (plotHeight / height) * rect.height;
    setHover({
      index,
      value,
      label: labelText,
      x: snappedX,
      y: yPx,
      rectWidth: rect.width,
      axisWidthPx,
      plotWidthPx,
    });
  }

  function handleLeave() {
    setHover(null);
  }

  return (
    <div className="w-full h-full min-h-[160px] flex flex-col relative group select-none bg-[#050505] border border-white/10 p-1">
      <div className="flex justify-between items-center px-1 mb-1 border-b border-white/5 pb-1">
        <span className="shrink-0 font-black uppercase tracking-[0.2em] text-[#00FF41] px-2 py-0.5 bg-[#00FF41]/10 text-[9px] border border-[#00FF41]/20">
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
            backgroundSize: "20px 20px",
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00FF41]/10 to-transparent w-[50%] h-full animate-[scan-x_3s_linear_infinite] pointer-events-none mix-blend-screen" />

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full preserve-3d absolute inset-0 z-10"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.5" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          <path
            d={`M${fillPath} Z`}
            fill={`url(#grad-${label})`}
          />
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            className="drop-shadow-[0_0_5px_rgba(0,255,65,0.8)]"
          />
        </svg>

        <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-between py-1 px-1 text-[7px] font-mono text-[#00FF41]/60 pointer-events-none bg-black/60 backdrop-blur-[1px] border-l border-white/5 w-8 text-right">
          <span>{formatCompact(max)}</span>
          <span>{formatCompact(max * 0.75)}</span>
          <span>{formatCompact(max * 0.5)}</span>
          <span>{formatCompact(max * 0.25)}</span>
          <span>0</span>
        </div>

        <div
          ref={plotRef}
          className="absolute inset-0 z-20"
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
        ></div>

        {hover ? (
          <>
            <div
              className="absolute inset-y-0 left-0 pointer-events-none z-25"
              style={{ right: hover.axisWidthPx }}
            >
              <div
                className="absolute top-0 bottom-0 w-px bg-[#00FF41]/40 shadow-[0_0_6px_rgba(0,255,65,0.35)]"
                style={{ left: hover.x }}
              ></div>
              <div
                className="absolute w-2 h-2 rounded-full bg-[#00FF41] shadow-[0_0_6px_rgba(0,255,65,0.8)]"
                style={{ left: hover.x - 4, top: hover.y - 4 }}
              ></div>
            </div>
            <div
              className="absolute z-30 px-2 py-1 text-[9px] font-mono bg-black/90 border border-[#00FF41]/30 text-[#00FF41] pointer-events-none"
              style={{
                left: Math.min(
                  hover.x + 10,
                  hover.rectWidth - hover.axisWidthPx - 120
                ),
                top: Math.max(hover.y - 24, 6),
              }}
            >
              <div className="opacity-70">
                {hover.label ? `${hover.label} UTC` : "UTC"}
              </div>
              <div className="font-bold">{formatFull(hover.value)} tokens</div>
            </div>
          </>
        ) : null}
      </div>

      <div className="h-4 flex justify-between items-center px-1 mt-1 text-[8px] font-mono text-[#00FF41]/40 border-t border-white/5 pt-1">
        {xLabels.map((labelText, idx) => (
          <span
            key={`${labelText}-${idx}`}
            className={
              labelText === "NOW" ? "text-[#00FF41] font-bold animate-pulse" : ""
            }
          >
            {labelText}
          </span>
        ))}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes scan-x {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `,
        }}
      />
    </div>
  );
}
