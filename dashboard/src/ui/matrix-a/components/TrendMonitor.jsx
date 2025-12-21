import React, { useMemo } from "react";

// --- Trend Monitor (NeuralFluxMonitor v2.0) ---
// Industrial TUI style: independent axes, precise grid, physical partitions.
export function TrendMonitor({
  data = [],
  color = "#00FF41",
  label = "NEURAL_FLUX",
}) {
  const safeData = data.length > 0 ? data : Array.from({ length: 24 }, () => 0);
  const max = Math.max(...safeData, 100);
  const avg = safeData.reduce((a, b) => a + b, 0) / safeData.length;

  const width = 100;
  const height = 100;

  const points = useMemo(() => {
    return safeData
      .map((val, i) => {
        const x = (i / (safeData.length - 1)) * width;
        const normalizedVal = val / max;
        const y = height - normalizedVal * height;
        return `${x},${y}`;
      })
      .join(" ");
  }, [safeData, max]);

  const fillPath = `${points} ${width},${height} 0,${height}`;

  return (
    <div className="w-full h-full min-h-[160px] flex flex-col relative group select-none bg-[#050505] border border-white/10 p-1">
      <div className="flex justify-between items-center px-1 mb-1 border-b border-white/5 pb-1">
        <span className="text-[9px] font-black uppercase tracking-widest text-[#00FF41]/80 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#00FF41] animate-pulse shadow-[0_0_5px_#00FF41]"></span>
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
            <mask id={`grid-mask-${label}`}>
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <path
                d="M0 20 H100 M0 40 H100 M0 60 H100 M0 80 H100"
                stroke="black"
                strokeWidth="0.5"
              />
            </mask>
          </defs>

          <path
            d={`M${fillPath} Z`}
            fill={`url(#grad-${label})`}
            mask={`url(#grid-mask-${label})`}
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
          <span>{Math.round(max)}k</span>
          <span>{Math.round(max * 0.75)}k</span>
          <span>{Math.round(max * 0.5)}k</span>
          <span>{Math.round(max * 0.25)}k</span>
          <span>0</span>
        </div>
      </div>

      <div className="h-4 flex justify-between items-center px-1 mt-1 text-[8px] font-mono text-[#00FF41]/40 border-t border-white/5 pt-1">
        <span>-24H</span>
        <span>-18H</span>
        <span>-12H</span>
        <span>-6H</span>
        <span className="text-[#00FF41] font-bold animate-pulse">NOW</span>
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
