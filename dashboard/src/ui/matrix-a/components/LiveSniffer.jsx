import React, { useState, useEffect } from "react";

/**
 * 实时演示组件 - 日志流
 */
export const LiveSniffer = () => {
  const [logs, setLogs] = useState([
    "[SYSTEM] KERNEL_UPLINK_ESTABLISHED",
    "[SOCKET] LISTENING_ON_LOCAL_CLI_PIPE...",
  ]);

  useEffect(() => {
    const events = [
      "> INTERCEPTED: CODEX_COMPLETION_EVENT",
      "> QUANTIFYING: +64 NEURAL_TOKENS",
      "> ANALYSIS: HIGH_VIBE_FLOW_DETECTED",
      "> SYNC: UPLOADING_TO_ZION_MAINFRAME",
      "[STATUS] BATCH_TRANSMISSION_COMPLETE",
      "> HOOKING: CODEX_CLI_PIPE_SIGNAL",
      "> CAPTURE: +128 NEURAL_TOKENS",
    ];
    let i = 0;
    const interval = setInterval(() => {
      setLogs((prev) => [...prev.slice(-4), events[i % events.length]]);
      i++;
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="font-mono text-[10px] text-[#00FF41]/80 space-y-1 h-full flex flex-col justify-end">
      {logs.map((log, idx) => (
        <div
          key={idx}
          className="animate-pulse border-l-2 border-[#00FF41]/20 pl-2 truncate"
        >
          {log}
        </div>
      ))}
    </div>
  );
};
