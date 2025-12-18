import React from "react";

const DataRow = ({ label, value, subValue, colorClass = "text-[#00FF41]" }) => (
  <div className="flex justify-between items-center border-b border-[#00FF41]/5 py-1.5 group hover:bg-[#00FF41]/5 transition-colors px-1">
    <span className="opacity-40 uppercase text-[8px] font-black tracking-widest leading-none">
      {label}
    </span>
    <div className="flex items-center space-x-3">
      {subValue && (
        <span className="text-[8px] opacity-20 italic font-mono">
          {subValue}
        </span>
      )}
      <span className={`font-black tracking-tight text-[11px] ${colorClass}`}>
        {value}
      </span>
    </div>
  </div>
);

export default DataRow;
