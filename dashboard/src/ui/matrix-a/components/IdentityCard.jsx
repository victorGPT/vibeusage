import React from "react";

import { copy } from "../../../lib/copy.js";
import { AsciiBox } from "./AsciiBox.jsx";
import { MatrixAvatar } from "./MatrixAvatar.jsx";
import { ScrambleText } from "./ScrambleText.jsx";

export function IdentityCard({
  name = copy("identity_card.name_default"),
  isPublic = false,
  onDecrypt,
  title = copy("identity_card.title_default"),
  subtitle,
  rankLabel,
  streakDays,
  showStats = true,
  animateTitle = true,
  scrambleDurationMs = 2200,
  scrambleLoop = false,
  scrambleLoopDelayMs = 2400,
  scrambleStartScrambled = true,
  scrambleRespectReducedMotion = false,
  scanlines = true,
  className = "",
  avatarSize = 80,
  animate = true,
}) {
  const unknownLabel = copy("identity_card.unknown");
  const displayName = isPublic ? name : unknownLabel;
  const avatarName = isPublic ? name : unknownLabel;
  const rankValue = rankLabel ?? copy("identity_card.rank_placeholder");
  const streakValue = Number.isFinite(Number(streakDays))
    ? copy("identity_card.streak_value", { days: Number(streakDays) })
    : copy("identity_card.rank_placeholder");
  const shouldShowStats =
    showStats && (rankLabel !== undefined || streakDays !== undefined);

  const titleNode =
    typeof title === "string" && animateTitle ? (
      <ScrambleText
        text={title}
        durationMs={scrambleDurationMs}
        loop={scrambleLoop}
        loopDelayMs={scrambleLoopDelayMs}
        startScrambled={scrambleStartScrambled}
        respectReducedMotion={scrambleRespectReducedMotion}
      />
    ) : (
      title
    );

  return (
    <AsciiBox title={titleNode} subtitle={subtitle} className={className}>
      <div className="relative overflow-hidden">
        {scanlines ? (
          <>
            <div className="pointer-events-none absolute inset-0 matrix-scanlines opacity-30 mix-blend-screen"></div>
            <div className="pointer-events-none absolute inset-0 matrix-scan-sweep opacity-20"></div>
          </>
        ) : null}

        <div className="relative z-10 flex items-center space-x-6 px-2">
          <MatrixAvatar
            name={avatarName}
            isAnon={!isPublic}
            size={avatarSize}
          />

          <div className="flex-1 space-y-2">
            <div>
              <div className="text-[8px] opacity-50 uppercase tracking-widest">
                {copy("identity_card.operator_label")}
              </div>
              <div className="text-white font-black text-xl tracking-tighter">
                {animate ? (
                  <ScrambleText
                    text={displayName}
                    durationMs={scrambleDurationMs}
                    loop={scrambleLoop}
                    loopDelayMs={scrambleLoopDelayMs}
                    startScrambled={scrambleStartScrambled}
                    respectReducedMotion={scrambleRespectReducedMotion}
                  />
                ) : (
                  displayName
                )}
              </div>
            </div>

            {!isPublic && onDecrypt ? (
              <button
                type="button"
                onClick={onDecrypt}
                className="text-[9px] text-black bg-[#00FF41] px-2 py-1 font-bold uppercase hover:bg-white transition-colors"
              >
                {copy("identity_card.decrypt")}
              </button>
            ) : null}

            {shouldShowStats ? (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="bg-[#00FF41]/5 p-1 border border-[#00FF41]/10 text-center">
                  <div className="text-[7px] opacity-40 uppercase font-black">
                    {copy("identity_card.rank_label")}
                  </div>
                  <div className="text-[#00FF41] font-black underline underline-offset-2">
                    {rankValue}
                  </div>
                </div>
                <div className="bg-[#00FF41]/5 p-1 border border-[#00FF41]/10 text-center">
                  <div className="text-[7px] opacity-40 uppercase font-black">
                    {copy("identity_card.streak_label")}
                  </div>
                  <div className="text-yellow-400 font-black tracking-tighter">
                    {streakValue}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AsciiBox>
  );
}
