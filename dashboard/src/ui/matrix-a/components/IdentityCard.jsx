import React from "react";

import { AsciiBox } from "./AsciiBox.jsx";
import { MatrixAvatar } from "./MatrixAvatar.jsx";
import { ScrambleText } from "./ScrambleText.jsx";

export function IdentityCard({
  name = "NEO.SYST_3M",
  isPublic = false,
  onDecrypt,
  title = "Identity_Matrix",
  subtitle,
  email,
  userId,
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
  const displayName = isPublic ? name : "UNKNOWN_GHOST";
  const avatarName = isPublic ? name : "unknown";
  const rankValue = rankLabel ?? "—";
  const streakValue = Number.isFinite(Number(streakDays))
    ? `${Number(streakDays)}_DAYS`
    : "—";
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
                Operator_Handle
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
              {email ? (
                <div className="text-[9px] opacity-40 mt-1 truncate">{email}</div>
              ) : null}
              {userId ? (
                <div className="text-[9px] opacity-25 mt-1 font-mono truncate">
                  {userId}
                </div>
              ) : null}
            </div>

            {!isPublic && onDecrypt ? (
              <button
                type="button"
                onClick={onDecrypt}
                className="text-[9px] text-black bg-[#00FF41] px-2 py-1 font-bold uppercase hover:bg-white transition-colors"
              >
                [ ! ] DECRYPT_IDENTITY
              </button>
            ) : null}

            {shouldShowStats ? (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="bg-[#00FF41]/5 p-1 border border-[#00FF41]/10 text-center">
                  <div className="text-[7px] opacity-40 uppercase font-black">
                    Rank
                  </div>
                  <div className="text-[#00FF41] font-black underline underline-offset-2">
                    {rankValue}
                  </div>
                </div>
                <div className="bg-[#00FF41]/5 p-1 border border-[#00FF41]/10 text-center">
                  <div className="text-[7px] opacity-40 uppercase font-black">
                    Streak
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
