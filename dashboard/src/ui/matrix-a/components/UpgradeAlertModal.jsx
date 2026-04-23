import { Button } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { copy } from "../../../lib/copy";
import { safeGetItem, safeSetItem, safeWriteClipboard } from "../../../lib/safe-browser";

export function UpgradeAlertModal({ requiredVersion, installCommand, onClose }) {
  const normalizedRequired = typeof requiredVersion === "string" ? requiredVersion.trim() : "";
  const hasVersion = normalizedRequired.length > 0;
  const unknownDismissKey = "vibeusage_upgrade_dismissed_unknown";
  const resolvedInstallCommand = installCommand ?? copy("dashboard.upgrade_alert.install_command");
  const sparkleLabel = copy("dashboard.upgrade_alert.sparkle");
  const titleLabel = copy("dashboard.upgrade_alert.title");
  const subtitleLabel = hasVersion
    ? copy("dashboard.upgrade_alert.subtitle", {
        required: normalizedRequired,
      })
    : copy("dashboard.upgrade_alert.subtitle_generic");
  const promptLabel = copy("dashboard.upgrade_alert.prompt");
  const copyLabel = copy("dashboard.upgrade_alert.copy");
  const copiedLabel = copy("dashboard.upgrade_alert.copied");
  const ignoreLabel = copy("dashboard.upgrade_alert.ignore");
  const [copied, setCopied] = useState(false);
  const storageKey = useMemo(
    () => (hasVersion ? `vibeusage_upgrade_dismissed_${normalizedRequired}` : unknownDismissKey),
    [hasVersion, normalizedRequired, unknownDismissKey],
  );
  const [isVisible, setIsVisible] = useState(() => {
    // If running on server, default to true (or handle hydration mismatch)
    if (typeof window === "undefined") return true;
    return !safeGetItem(storageKey);
  });
  const bannerRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = safeGetItem(storageKey);
    setIsVisible(!dismissed);
  }, [storageKey]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (!isVisible) {
      root.style.setProperty("--matrix-banner-offset", "0px");
      return;
    }
    const updateOffset = () => {
      const height = bannerRef.current?.offsetHeight ?? 0;
      root.style.setProperty("--matrix-banner-offset", `${height}px`);
    };
    updateOffset();
    window.addEventListener("resize", updateOffset);
    return () => {
      window.removeEventListener("resize", updateOffset);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const handleCopy = async () => {
    const didCopy = await safeWriteClipboard(resolvedInstallCommand);
    if (!didCopy) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDismiss = () => {
    safeSetItem(storageKey, "true");
    setIsVisible(false);
    if (onClose) onClose();
  };

  return (
    <div
      ref={bannerRef}
      className="fixed top-0 left-0 right-0 z-[200] border-b border-gold/30 bg-surface/95 backdrop-blur-md shadow-gold-faint overflow-hidden"
    >
      {/* Scanline effect — gold variant for gold alert banner. */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <div className="w-full h-full fx-scanline-gold" />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-2 relative flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left Side: Notice & Mission */}
        <div className="flex items-center space-x-3">
          <span className="text-heading animate-pulse">{sparkleLabel}</span>
          <div className="flex flex-col">
            <h3 className="text-gold font-black text-heading uppercase leading-none">
              {titleLabel}
            </h3>
            <p className="text-caption text-gold/60 uppercase mt-1">{subtitleLabel}</p>
          </div>
        </div>

        {/* Middle: Command Area */}
        <div className="flex-1 flex items-center justify-center max-w-xl w-full">
          <div className="flex items-center w-full bg-surface-raised border border-gold/20 pl-3 rounded-sm group hover:border-gold/40 transition-all overflow-hidden">
            <span className="text-caption text-gold/80 shrink-0">{promptLabel}</span>
            <Input
              readOnly
              value={resolvedInstallCommand}
              className="bg-transparent border-none text-body text-gray-300 w-full px-2 py-1 outline-none pointer-events-none"
            />
            <Button
              onClick={handleCopy}
              className="shrink-0 bg-gold/10 hover:bg-gold/20 border-l border-gold/20 px-3 py-1.5 text-caption font-black uppercase text-gold transition-all"
            >
              {copied ? copiedLabel : copyLabel}
            </Button>
          </div>
        </div>

        {/* Right Side: Actions */}
        <div className="flex items-center space-x-4">
          <Button
            onClick={handleDismiss}
            className="text-caption font-black uppercase text-gold/40 hover:text-gold transition-all tracking-caps"
          >
            {ignoreLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
