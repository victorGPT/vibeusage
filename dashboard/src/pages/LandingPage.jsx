import React, { Suspense, useEffect, useMemo, useState } from "react";
import { DecodingText } from "../ui/matrix-a/components/DecodingText.jsx";
import { GithubStar } from "../ui/matrix-a/components/GithubStar.jsx";
import { MatrixButton } from "../ui/matrix-a/components/MatrixButton.jsx";
import { copy } from "../lib/copy.js";

const MatrixRain = React.lazy(() =>
  import("../ui/matrix-a/components/MatrixRain.jsx").then((mod) => ({
    default: mod.MatrixRain,
  }))
);
const LandingExtras = React.lazy(() =>
  import("./LandingExtras.jsx").then((mod) => ({
    default: mod.LandingExtras,
  }))
);

function useDeferredMount(delayMs = 0) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let timer = null;
    let idleId = null;
    const run = () => setMounted(true);

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(run, { timeout: delayMs || 200 });
      return () => {
        if (typeof window.cancelIdleCallback === "function" && idleId != null) {
          window.cancelIdleCallback(idleId);
        }
      };
    }

    timer = window.setTimeout(run, delayMs);
    return () => {
      if (timer != null) window.clearTimeout(timer);
    };
  }, [delayMs]);

  return mounted;
}

export function LandingPage({ signInUrl, signUpUrl }) {
  const specialHandle = copy("landing.handle.special");
  const defaultHandle = copy("landing.handle.default");
  const loginLabel = copy("landing.nav.login");
  const signupLabel = copy("landing.nav.signup");
  const [handle, setHandle] = useState(defaultHandle);
  const effectsReady = useDeferredMount(250);
  const installEntryKey = "vibescore.dashboard.from_landing.v1";

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(installEntryKey, "1");
    } catch (_e) {
      // ignore write errors (private mode/quota)
    }
  }, [installEntryKey]);

  const handlePlaceholder = useMemo(
    () => copy("landing.handle.placeholder", { handle: specialHandle }),
    [specialHandle]
  );

  const rankLabel = useMemo(() => {
    const rank =
      handle === specialHandle
        ? copy("landing.rank.singularity")
        : copy("landing.rank.unranked");
    return copy("landing.rank.expectation", { rank });
  }, [handle, specialHandle]);

  const handleChange = (event) => {
    setHandle(event.target.value.toUpperCase());
  };

  const extrasSkeleton = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
      <div className="h-44 border border-[#00FF41]/15 bg-[#00FF41]/5"></div>
      <div className="h-44 border border-[#00FF41]/15 bg-[#00FF41]/5"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-matrix-dark font-matrix text-matrix-primary text-body flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {effectsReady ? (
        <Suspense fallback={null}>
          <MatrixRain />
        </Suspense>
      ) : null}
      <div className="fixed top-6 right-6 z-[70] flex flex-col items-end space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-3">
        <GithubStar isFixed={false} size="header" />
        <MatrixButton
          as="a"
          href={signInUrl}
          size="header"
          className="matrix-header-action--ghost"
        >
          <span className="font-matrix font-black text-caption tracking-[0.12em] text-matrix-primary">
            {loginLabel}
          </span>
        </MatrixButton>
        <MatrixButton
          as="a"
          href={signUpUrl}
          size="header"
          className="matrix-header-chip--solid"
        >
          <span className="font-matrix font-black text-caption tracking-[0.12em] text-black">
            {signupLabel}
          </span>
        </MatrixButton>
      </div>
      <div className="pointer-events-none fixed inset-0 z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px]"></div>

      {/* 主面板 */}
      <main className="w-full max-w-4xl relative z-10 flex flex-col items-center space-y-12 py-10">
        {/* Slogan 区域 */}
        <div className="text-center space-y-6">
          <h1 className="text-5xl md:text-8xl font-black text-white tracking-tighter leading-none glow-text select-none">
            <DecodingText text={copy("landing.hero.title_primary")} /> <br />
            <span className="text-matrix-primary">
              <DecodingText text={copy("landing.hero.title_secondary")} />
            </span>
          </h1>

          <div className="flex flex-col items-center space-y-2">
            <div className="px-6 py-3 border border-matrix-ghost bg-matrix-panel relative group">
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-matrix-primary"></div>
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-matrix-primary"></div>
              <p className="text-caption uppercase font-bold text-matrix-bright">
                {copy("landing.hero.tagline")}
              </p>
            </div>
            {/* 包含 Codex CLI Token 的精准描述 */}
            <p className="text-caption text-matrix-muted uppercase">
              {copy("landing.hero.subtagline")}
            </p>
          </div>
        </div>

        {/* 演示区域 */}
        {effectsReady ? (
          <Suspense fallback={extrasSkeleton}>
            <LandingExtras
              handle={handle}
              onHandleChange={handleChange}
              specialHandle={specialHandle}
              handlePlaceholder={handlePlaceholder}
              rankLabel={rankLabel}
            />
          </Suspense>
        ) : (
          extrasSkeleton
        )}

        <section className="w-full max-w-3xl border border-matrix-ghost bg-matrix-panel px-6 py-6 space-y-4">
          <h2 className="text-2xl md:text-3xl font-bold text-matrix-bright tracking-tight">
            {copy("landing.seo.title")}
          </h2>
          <p className="text-body text-matrix-muted">
            {copy("landing.seo.summary")}
          </p>
          <ul className="space-y-2 text-body text-matrix-muted">
            <li className="flex gap-2">
              <span className="text-matrix-primary">-</span>
              <span>{copy("landing.seo.point1")}</span>
            </li>
            <li className="flex gap-2">
              <span className="text-matrix-primary">-</span>
              <span>{copy("landing.seo.point2")}</span>
            </li>
            <li className="flex gap-2">
              <span className="text-matrix-primary">-</span>
              <span>{copy("landing.seo.point3")}</span>
            </li>
          </ul>
          <p className="text-caption text-matrix-dim uppercase">
            {copy("landing.seo.roadmap")}
          </p>
        </section>

        {/* 核心操作区域 */}
        <div className="w-full max-w-sm flex flex-col items-center space-y-4">
          <a
            href={signInUrl}
            className="block w-full group relative border-2 border-matrix-primary bg-matrix-panelStrong py-5 overflow-hidden transition-all hover:bg-matrix-primary hover:text-black active:scale-95 shadow-[0_0_20px_rgba(0,255,65,0.2)] text-center no-underline text-matrix-primary hover:text-black"
          >
            <span className="font-black uppercase tracking-[0.4em] text-heading relative z-10 animate-pulse group-hover:animate-none">
              {copy("landing.cta.initialize")}
            </span>
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
          </a>

          {/* 核心补充 */}
          <div className="text-center">
            <p className="text-caption text-matrix-muted uppercase font-bold">
              {copy("landing.cta.subtext")}
            </p>
          </div>

          <div className="flex space-x-8 text-caption uppercase tracking-widest text-matrix-dim pt-4">
            <span className="hover:text-matrix-bright cursor-pointer transition-colors">
              {copy("landing.footer.link.manifesto")}
            </span>
            <span className="hover:text-matrix-bright cursor-pointer transition-colors">
              {copy("landing.footer.link.docs")}
            </span>
            <span className="hover:text-matrix-bright cursor-pointer transition-colors">
              {copy("landing.footer.link.security")}
            </span>
          </div>
        </div>
      </main>

      <footer className="absolute bottom-8 text-caption text-matrix-dim tracking-[0.6em] uppercase select-none">
        {copy("landing.footer.system_ready")}
      </footer>
    </div>
  );
}
