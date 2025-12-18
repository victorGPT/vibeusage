import React from "react";

const MatrixTable = ({ columns, data, className = "" }) => {
  if (!data || data.length === 0) {
    return (
      <div className="border border-[#00FF41]/20 p-8 text-center text-[#00FF41]/50 font-mono text-xs uppercase tracking-widest bg-[#00FF41]/5">
        NO_DATA_STREAM_DETECTED
      </div>
    );
  }

  return (
    <div
      className={`w-full overflow-x-auto no-scrollbar border border-[#00FF41]/20 ${className}`}
    >
      <table className="w-full text-left font-mono text-xs border-collapse">
        <thead className="bg-[#00FF41]/10 text-[#00FF41]">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 font-bold uppercase tracking-wider border-b border-[#00FF41]/20 text-[10px]"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#00FF41]/10">
          {data.map((row, i) => (
            <tr
              key={i}
              className="hover:bg-[#00FF41]/5 transition-colors group"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-2.5 ${
                    col.align === "right" ? "text-right" : "text-left"
                  } ${col.className || ""}`}
                >
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MatrixTable;
