import React, { useMemo } from "react";
import MatrixPanel from "../matrix/MatrixPanel";
import MatrixButton from "../matrix/MatrixButton";

function buildAuthUrl({ baseUrl, path, redirectUrl }) {
  const u = new URL(path, baseUrl);
  u.searchParams.set("redirect", redirectUrl);
  return u.toString();
}

const AuthView = ({ defaultInsforgeBaseUrl }) => {
  const url = useMemo(() => new URL(window.location.href), []);
  const redirect = url.searchParams.get("redirect") || "";
  const baseUrlOverride = url.searchParams.get("base_url") || "";

  let redirectUrl = null;
  try {
    redirectUrl = new URL(redirect);
  } catch (_e) {}

  const safeRedirect =
    redirectUrl &&
    redirectUrl.protocol === "http:" &&
    (redirectUrl.hostname === "127.0.0.1" ||
      redirectUrl.hostname === "localhost")
      ? redirectUrl.toString()
      : null;

  const insforgeBaseUrl = baseUrlOverride || defaultInsforgeBaseUrl;

  const signInUrl = useMemo(() => {
    if (!safeRedirect) return null;
    return buildAuthUrl({
      baseUrl: insforgeBaseUrl,
      path: "/auth/sign-in",
      redirectUrl: safeRedirect,
    });
  }, [insforgeBaseUrl, safeRedirect]);

  const signUpUrl = useMemo(() => {
    if (!safeRedirect) return null;
    return buildAuthUrl({
      baseUrl: insforgeBaseUrl,
      path: "/auth/sign-up",
      redirectUrl: safeRedirect,
    });
  }, [insforgeBaseUrl, safeRedirect]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <MatrixPanel
        title="ACCESS_PROTOCOL"
        subtitle="CLI_LINK"
        className="w-full max-w-md"
      >
        <div className="space-y-6 text-center py-6">
          <div>
            <div className="text-xl font-black mb-2 tracking-widest text-[#00FF41] glow-text">
              VIBE_SCORE
            </div>
            <div className="text-xs opacity-60 uppercase tracking-[0.2em] mb-8">
              Secure Neural Uplink
            </div>

            <p className="text-xs opacity-70 mb-8 font-mono leading-relaxed max-w-[80%] mx-auto">
              Initiate handshake protocol to link local CLI environment with
              VibeScore Nexus.
            </p>
          </div>

          {!safeRedirect ? (
            <div className="border border-red-500/50 bg-red-500/10 p-4 text-xs text-red-400 font-mono text-left">
              <div className="font-bold mb-1">[!] CRITICAL_ERROR</div>
              Invalid redirect target. Access denied.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 px-4">
              <a href={signInUrl} className="block w-full no-underline">
                <MatrixButton primary className="w-full">
                  INIT_SESSION
                </MatrixButton>
              </a>
              <a href={signUpUrl} className="block w-full no-underline">
                <MatrixButton className="w-full">REGISTER_ID</MatrixButton>
              </a>
            </div>
          )}

          <div className="text-[9px] opacity-30 uppercase tracking-widest mt-8">
            Encryption: AES-256-GCM // Status: READY
          </div>
        </div>
      </MatrixPanel>
    </div>
  );
};

export default AuthView;
