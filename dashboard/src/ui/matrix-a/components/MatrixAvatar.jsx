import React, { useMemo } from "react";

function hashCode(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

export function MatrixAvatar({
  name = "unknown",
  isAnon = false,
  isTheOne = false,
  size = 64,
  className = "",
}) {
  const hash = useMemo(() => hashCode(String(name || "unknown")), [name]);
  const grid = useMemo(() => {
    const cells = [];
    for (let i = 0; i < 15; i += 1) {
      cells.push(((hash >> i) & 1) === 1);
    }
    return cells;
  }, [hash]);

  const color = isAnon ? "#333" : isTheOne ? "#FFD700" : "#00FF41";
  const glowFilter = isAnon
    ? "none"
    : isTheOne
    ? "drop-shadow(0 0 8px rgba(255, 215, 0, 0.8)) drop-shadow(0 0 15px rgba(255, 255, 255, 0.5))"
    : "drop-shadow(0 0 4px rgba(0, 255, 65, 0.6))";

  if (isAnon) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`bg-[#00FF41]/5 border border-[#00FF41]/20 flex items-center justify-center overflow-hidden ${className}`}
      >
        <span className="text-[#00FF41] font-black text-xl opacity-50">?</span>
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative p-1 transition-transform duration-300 hover:scale-105 ${
        isTheOne
          ? "bg-yellow-900/20 border border-yellow-500/50"
          : "bg-[#001100] border border-[#00FF41]/40"
      } ${className}`}
    >
      {isTheOne ? (
        <div className="absolute inset-0 bg-white opacity-10 animate-pulse mix-blend-overlay"></div>
      ) : null}

      <svg
        viewBox="0 0 5 5"
        className="w-full h-full"
        style={{ filter: glowFilter }}
      >
        {grid.map((filled, i) => {
          if (!filled) return null;
          const r = Math.floor(i / 3);
          const c = i % 3;
          return (
            <React.Fragment key={i}>
              <rect x={c} y={r} width="1" height="1" fill={color} />
              {c < 2 ? (
                <rect x={4 - c} y={r} width="1" height="1" fill={color} />
              ) : null}
            </React.Fragment>
          );
        })}
      </svg>
    </div>
  );
}
