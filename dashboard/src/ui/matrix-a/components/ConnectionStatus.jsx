import React, { useEffect, useMemo, useState } from "react";
import { isScreenshotModeEnabled } from "../../../lib/screenshot-mode.js";

export function ConnectionStatus({ status = "STABLE", title, className = "" }) {
  const [bit, setBit] = useState("0");
  const screenshotMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    return isScreenshotModeEnabled(window.location.search);
  }, []);

  useEffect(() => {
    let interval;
    if (status === "STABLE") {
      if (screenshotMode) {
        setBit("1");
        return undefined;
      }
      interval = window.setInterval(() => {
        setBit(Math.random() > 0.5 ? "1" : "0");
      }, 150);
    }
    return () => window.clearInterval(interval);
  }, [screenshotMode, status]);

  const configs = {
    STABLE: {
      color: "text-ink",
      indicator: bit,
    },
    UNSTABLE: {
      color: "text-yellow-400",
      indicator: "!",
    },
    LOST: {
      color: "text-red-500/90",
      indicator: "×",
    },
  };

  const current = configs[status] || configs.STABLE;

  return (
    <div
      title={title}
      className={[
        "btn-chip btn-chip--bare font-mono transition-all duration-700",
        current.color,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-center">
        <span className="text-caption text-ink-muted mr-1">[</span>
        <span className="text-caption w-[10px] inline-block text-center font-black">
          {current.indicator}
        </span>
        <span className="text-caption text-ink-muted ml-1">]</span>
      </div>
    </div>
  );
}
