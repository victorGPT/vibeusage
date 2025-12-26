import React, { useState } from "react";
import { AsciiBox } from "./AsciiBox.jsx";
import { MatrixButton } from "./MatrixButton.jsx";
import { copy } from "../../../lib/copy.js"; // 假设有copy文件，或者这里直接写死文本

export function UpgradeAlertModal({
  currentVersion = "0.1",
  requiredVersion = "0.1.1",
  installCommand = "npx --yes @vibescore/tracker init",
  onClose,
}) {
  const [copied, setCopied] = useState(false);
  const storageKey = `vibescore_upgrade_dismissed_${requiredVersion}`;
  const [isVisible, setIsVisible] = useState(() => {
    // If running on server, default to true (or handle hydration mismatch)
    if (typeof window === "undefined") return true;
    return !localStorage.getItem(storageKey);
  });

  if (!isVisible) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDismiss = () => {
    localStorage.setItem(storageKey, "true");
    setIsVisible(false);
    if (onClose) onClose();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] border-b border-[#FFD700]/30 bg-black/95 backdrop-blur-md shadow-[0_0_20px_rgba(255,215,0,0.1)] overflow-hidden">
      {/* 扫描线效果 */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <div className="w-full h-full bg-[linear-gradient(rgba(255,215,0,0)_50%,rgba(255,215,0,0.1)_50%)] bg-[length:100%_4px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-2 relative flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left Side: Notice & Mission */}
        <div className="flex items-center space-x-3">
          <span className="text-xl animate-pulse">✨</span>
          <div className="flex flex-col">
            <h3 className="text-[#FFD700] font-black tracking-tighter text-[10px] uppercase leading-none">
              System_Upgrade_Pending
            </h3>
            <p className="text-[8px] text-[#FFD700]/60 font-mono uppercase tracking-widest mt-0.5">
              Protocol v{requiredVersion} available (Pulse check: v
              {currentVersion})
            </p>
          </div>
        </div>

        {/* Middle: Command Area */}
        <div className="flex-1 flex items-center justify-center max-w-xl w-full">
          <div className="flex items-center w-full bg-black/50 border border-[#FFD700]/20 pl-3 rounded-sm group hover:border-[#FFD700]/40 transition-all overflow-hidden">
            <span className="font-mono text-[9px] text-[#FFD700]/80 shrink-0">
              $
            </span>
            <input
              readOnly
              value={installCommand}
              className="bg-transparent border-none text-[10px] font-mono text-gray-300 w-full px-2 py-1 outline-none pointer-events-none"
            />
            <button
              onClick={handleCopy}
              className="shrink-0 bg-[#FFD700]/10 hover:bg-[#FFD700]/20 border-l border-[#FFD700]/20 px-3 py-1.5 text-[9px] font-black uppercase text-[#FFD700] transition-all"
            >
              {copied ? "[ COPIED ]" : "[ COPY ]"}
            </button>
          </div>
        </div>

        {/* Right Side: Actions */}
        <div className="flex items-center space-x-4">
          <button
            onClick={handleDismiss}
            className="text-[9px] font-black uppercase text-[#FFD700]/40 hover:text-[#FFD700] transition-all tracking-[0.2em]"
          >
            [ IGNORE_NOTICE ]
          </button>
        </div>
      </div>
    </div>
  );
}
