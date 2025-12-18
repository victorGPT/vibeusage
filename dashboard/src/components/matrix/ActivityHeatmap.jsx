import React, { useMemo } from "react";

const ActivityHeatmap = ({ data = [], year = new Date().getFullYear() }) => {
  // Mock generation for the heatmap visual (since we only have limited daily data)
  // In a real app we would map `data` (daily totals) to specific dates.

  const heatmapLayout = useMemo(() => {
    const rows = 7;
    const monthGroups = 12;
    const weeksPerGroup = 4;
    let groups = [];
    for (let g = 0; g < monthGroups; g++) {
      let weekArray = [];
      for (let w = 0; w < weeksPerGroup; w++) {
        let dayArray = [];
        for (let d = 0; d < rows; d++) {
          const noise = Math.random();
          let level =
            noise > 0.9
              ? 4
              : noise > 0.7
              ? 3
              : noise > 0.5
              ? 2
              : noise > 0.3
              ? 1
              : 0;
          if (d === 0 || d === 6)
            if (Math.random() > 0.5) level = Math.max(0, level - 2);
          dayArray.push(level);
        }
        weekArray.push(dayArray);
      }
      groups.push(weekArray);
    }
    return groups;
  }, []);

  return (
    <div className="w-full">
      <div className="overflow-x-auto no-scrollbar py-1">
        <div className="flex space-x-1.5 min-w-fit">
          {heatmapLayout.map((group, gIdx) => (
            <div
              key={gIdx}
              className="flex space-x-0.5 border-r border-[#00FF41]/10 pr-1.5 last:border-none"
            >
              {group.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col space-y-0.5">
                  {week.map((level, dIdx) => (
                    <span
                      key={dIdx}
                      className={`text-[9px] leading-none transition-all duration-700 ${
                        level === 0
                          ? "text-[#00FF41]/10"
                          : "text-[#00FF41] shadow-glow"
                      }`}
                      style={{
                        opacity: level === 0 ? 0.15 : 0.3 + level * 0.175,
                      }}
                    >
                      {level === 0 ? "·" : "■"}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between items-center mt-3 text-[7px] border-t border-[#00FF41]/5 pt-2 opacity-50 font-black uppercase tracking-widest">
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
        <span>Sync_Freq: 120s</span>
      </div>
    </div>
  );
};

export default ActivityHeatmap;
