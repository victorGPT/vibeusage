import { Input } from "@base-ui/react/input";
import React from "react";
import { copy } from "../../../lib/copy.js";
import { MatrixAvatar } from "../../foundation/MatrixAvatar.jsx";
import { SignalBox } from "../../foundation/SignalBox.jsx";
import { LiveSniffer } from "./LiveSniffer.jsx";

export function LandingExtras({
  handle,
  onHandleChange,
  specialHandle,
  handlePlaceholder,
  rankLabel,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
      <SignalBox title={copy("landing.signal.identity_probe")} className="h-44">
        <div className="flex items-center space-x-6 h-full">
          <MatrixAvatar name={handle} size={80} isTheOne={handle === specialHandle} />
          <div className="flex-1 text-left space-y-3">
            <div className="flex flex-col">
              <label className="text-caption text-ink-text uppercase mb-2 font-bold">
                {copy("landing.handle.label")}
              </label>
              <Input
                type="text"
                value={handle}
                onChange={onHandleChange}
                className="w-full bg-transparent border-b border-ink-muted text-ink-bright font-black text-display-3 md:text-display-3 p-1 focus:outline-none focus:border-ink transition-colors"
                maxLength={10}
                placeholder={handlePlaceholder}
              />
            </div>
            <div className="text-caption text-ink-text">{rankLabel}</div>
          </div>
        </div>
      </SignalBox>

      <SignalBox title={copy("landing.signal.live_sniffer")} className="h-44">
        <LiveSniffer />
      </SignalBox>
    </div>
  );
}
