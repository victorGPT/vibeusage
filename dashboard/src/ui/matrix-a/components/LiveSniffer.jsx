import React, { useEffect, useMemo, useState } from "react";
import { copy } from "../../../lib/copy";
import { isScreenshotModeEnabled } from "../../../lib/screenshot-mode";
import { shouldRunLiveSniffer } from "../util/should-run-live-sniffer.js";

function usePrefersReducedMotion() {
  return useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
}

/**
 * 实时演示组件 - 日志流
 */
export const LiveSniffer = () => {
  const [logs, setLogs] = useState([
    copy("live_sniffer.log.system"),
    copy("live_sniffer.log.socket"),
  ]);
  const reduceMotion = usePrefersReducedMotion();
  const screenshotMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    return isScreenshotModeEnabled(window.location.search);
  }, []);
  const shouldRun = shouldRunLiveSniffer({
    prefersReducedMotion: reduceMotion,
    screenshotMode,
  });

  useEffect(() => {
    if (!shouldRun) return undefined;
    const events = [
      copy("live_sniffer.event.intercepted"),
      copy("live_sniffer.event.quantifying"),
      copy("live_sniffer.event.analysis"),
      copy("live_sniffer.event.sync"),
      copy("live_sniffer.event.batch"),
      copy("live_sniffer.event.hooking"),
      copy("live_sniffer.event.capture"),
    ];
    let i = 0;
    const interval = setInterval(() => {
      setLogs((prev) => [...prev.slice(-4), events[i % events.length]]);
      i++;
    }, 1500);
    return () => clearInterval(interval);
  }, [shouldRun]);

  return (
    <div className="font-mono text-caption text-ink-text space-y-2 h-full flex flex-col justify-end">
      {logs.map((log, idx) => (
        <div key={idx} className="animate-pulse border-l-2 border-ink-faint pl-2 truncate">
          {log}
        </div>
      ))}
    </div>
  );
};
