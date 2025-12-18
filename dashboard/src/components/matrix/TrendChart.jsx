import React from "react";

const TrendChart = ({ data }) => {
  const max = Math.max(...data) || 1;
  return (
    <div className="flex flex-col space-y-2 w-full">
      <div className="flex items-end h-24 space-x-1 border-b border-[#00FF41]/20 pb-1 relative">
        {/* Background grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
          <div className="border-t border-[#00FF41] w-full"></div>
          <div className="border-t border-[#00FF41] w-full"></div>
          <div className="border-t border-[#00FF41] w-full"></div>
        </div>
        {data.map((val, i) => (
          <div
            key={i}
            className="flex-1 bg-[#00FF41]/5 relative group px-[1px]"
          >
            <div
              style={{ height: `${(val / max) * 100}%` }}
              className="w-full bg-[#00FF41] opacity-50 group-hover:opacity-100 group-hover:bg-white transition-all duration-300 shadow-[0_0_10px_rgba(0,255,65,0.2)]"
            ></div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[7px] opacity-30 font-black uppercase tracking-[0.2em]">
        <span>T-30D</span>
        <span>Peak: {max.toLocaleString()}</span>
        <span>Flow</span>
      </div>
    </div>
  );
};

export default TrendChart;
