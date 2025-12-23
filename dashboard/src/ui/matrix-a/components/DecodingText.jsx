import React, { useState, useEffect } from "react";

/**
 * 稳定版解码文字 (Ultra-Stable)
 */
export const DecodingText = ({ text = "", className = "" }) => {
  const [display, setDisplay] = useState(() => String(text || ""));
  const chars = "0101XYZA@#$%";

  useEffect(() => {
    const target = String(text || "");
    if (!target) return;

    setDisplay(target);
    let iterations = 0;
    const step = Math.max(1, Math.ceil(target.length / 12));
    const intervalMs = 24;
    const interval = setInterval(() => {
      setDisplay(() => {
        const baseText = String(target);
        return baseText
          .split("")
          .map((char, index) => {
            if (index < iterations) return baseText[index];
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("");
      });

      if (iterations >= target.length) clearInterval(interval);
      iterations += step;
    }, intervalMs);

    return () => clearInterval(interval);
  }, [text]);

  return <span className={className}>{display}</span>;
};
