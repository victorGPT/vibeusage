import React, { Suspense } from "react";
import { DecodingText } from "../../foundation/DecodingText.jsx";
import { MatrixButton } from "../../foundation/MatrixButton.jsx";
import { GithubStar } from "../components/GithubStar.jsx";

const MatrixRain = React.lazy(() =>
  import("../components/MatrixRain.jsx").then((mod) => ({
    default: mod.MatrixRain,
  })),
);
const LandingExtras = React.lazy(() =>
  import("../components/LandingExtras.jsx").then((mod) => ({
    default: mod.LandingExtras,
  })),
);

export function LandingView({
  copy,
  effectsReady,
  signInUrl,
  signUpUrl,
  loginLabel,
  signupLabel,
  handle,
  onHandleChange,
  specialHandle,
  handlePlaceholder,
  rankLabel,
  installCommand,
  installCopied,
  onCopyInstallCommand,
}) {
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
        <MatrixButton as="a" href={signInUrl} size="header" className="matrix-header-action--ghost">
          <span className="font-matrix font-black text-caption tracking-[0.12em] text-matrix-primary">
            {loginLabel}
          </span>
        </MatrixButton>
        <MatrixButton as="a" href={signUpUrl} size="header" className="matrix-header-chip--solid">
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
              onHandleChange={onHandleChange}
              specialHandle={specialHandle}
              handlePlaceholder={handlePlaceholder}
              rankLabel={rankLabel}
            />
          </Suspense>
        ) : (
          extrasSkeleton
        )}

        <section className="w-full max-w-4xl border border-matrix-ghost bg-matrix-panel p-4">
          <div className="relative overflow-hidden border border-matrix-dim bg-black/60 shadow-[0_0_30px_rgba(0,255,65,0.15)]">
            <img
              src="/landing-dashboard.jpg"
              alt={copy("landing.screenshot.alt")}
              className="block w-full h-auto"
              loading="lazy"
              decoding="async"
            />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(0,255,65,0.08),rgba(0,0,0,0)_40%)]"></div>
          </div>
        </section>

        <section className="w-full max-w-3xl border border-matrix-ghost bg-matrix-panel px-6 py-6 space-y-4">
          <h2 className="text-2xl md:text-3xl font-bold text-matrix-bright tracking-tight">
            {copy("landing.install.title")}
          </h2>
          <p className="text-caption text-matrix-muted uppercase">{copy("landing.install.prompt")}</p>
          <div className="border border-matrix-dim bg-black/70 px-4 py-3 flex items-center gap-3">
            <div className="min-w-0 flex-1 overflow-x-auto">
              <code className="font-matrix text-body text-matrix-primary whitespace-nowrap">
                {installCommand}
              </code>
            </div>
            <button
              type="button"
              aria-label={
                installCopied
                  ? copy("landing.install.action.copied")
                  : copy("landing.install.action.copy")
              }
              title={
                installCopied
                  ? copy("landing.install.action.copied")
                  : copy("landing.install.action.copy")
              }
              onClick={onCopyInstallCommand}
              className="shrink-0 inline-flex h-8 w-8 items-center justify-center border border-matrix-ghost text-matrix-primary hover:text-matrix-bright hover:border-matrix-dim transition-colors"
            >
              {installCopied ? (
                <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 10.5 8 14.5 16 6.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="7" y="7" width="9" height="9" rx="1.5" />
                  <path d="M4 13V4h9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-caption text-matrix-dim uppercase">{copy("landing.install.helper")}</p>
        </section>

        <section className="w-full max-w-3xl border border-matrix-ghost bg-matrix-panel px-6 py-6 space-y-4">
          <h2 className="text-2xl md:text-3xl font-bold text-matrix-bright tracking-tight">
            {copy("landing.seo.title")}
          </h2>
          <p className="text-body text-matrix-muted">{copy("landing.seo.summary")}</p>
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
          <p className="text-caption text-matrix-dim uppercase">{copy("landing.seo.roadmap")}</p>
        </section>

        {/* 核心操作区域 */}
        <div className="w-full max-w-sm flex flex-col items-center space-y-4">
          <a
            href={signUpUrl}
            className="w-full text-center text-black bg-matrix-primary font-black uppercase tracking-[0.3em] py-4 hover:bg-white transition-colors"
          >
            {copy("landing.cta.primary")}
          </a>
          <a
            href={signInUrl}
            className="w-full text-center text-matrix-primary border border-matrix-primary font-black uppercase tracking-[0.3em] py-4 hover:bg-matrix-primary/10 transition-colors"
          >
            {copy("landing.cta.secondary")}
          </a>
        </div>
      </main>
    </div>
  );
}
