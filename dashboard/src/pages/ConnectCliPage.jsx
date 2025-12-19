import React, { useMemo } from "react";

import { buildAuthUrl } from "../lib/auth-url.js";
import { BackendStatus } from "../components/BackendStatus.jsx";
import { AsciiBox } from "../ui/matrix-a/components/AsciiBox.jsx";
import { MatrixButton } from "../ui/matrix-a/components/MatrixButton.jsx";
import { MatrixShell } from "../ui/matrix-a/layout/MatrixShell.jsx";

export function ConnectCliPage({ defaultInsforgeBaseUrl }) {
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
    (redirectUrl.hostname === "127.0.0.1" || redirectUrl.hostname === "localhost")
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
    <MatrixShell
      headerStatus={<BackendStatus baseUrl={insforgeBaseUrl} />}
      headerRight={<span className="text-[10px] opacity-60">Connect_CLI</span>}
      footerLeft={
        <span>
          Click sign-in/sign-up • browser returns to local CLI callback
        </span>
      }
      footerRight={<span className="font-bold">/connect</span>}
    >
      <div className="flex items-center justify-center">
        <AsciiBox title="Link_Your_CLI" subtitle="Local_Callback" className="w-full max-w-2xl">
          <p className="text-[10px] opacity-50 mt-0">
            Sign in or sign up. When finished, the browser will return to your local
            CLI to complete setup.
          </p>

          {!safeRedirect ? (
            <div className="mt-4 text-[10px] text-red-400/90">
              Invalid or missing{" "}
              <code className="px-1 py-0.5 bg-black/40 border border-[#00FF41]/20">
                redirect
              </code>{" "}
              URL. This page must be opened from the CLI.
            </div>
          ) : (
            <div className="flex flex-wrap gap-3 mt-4">
              <MatrixButton as="a" primary href={signInUrl}>
                $ sign-in
              </MatrixButton>
              <MatrixButton as="a" href={signUpUrl}>
                $ sign-up
              </MatrixButton>
            </div>
          )}
        </AsciiBox>
      </div>
    </MatrixShell>
  );
}
