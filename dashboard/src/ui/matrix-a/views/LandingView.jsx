import React, { Suspense, useState } from "react";
import { DecodingText } from "../../foundation/DecodingText.jsx";
import { MatrixButton } from "../../foundation/MatrixButton.jsx";
import { GithubStar } from "../components/GithubStar.jsx";
import { ClientLogoRow } from "../components/ClientLogoRow.jsx";

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

// Unified Matrix card shell (clean + consistent)
function MatrixCard({ children, className = "", header }) {
  return (
    <section className={`relative overflow-hidden border border-ink-muted bg-surface-strong ${className}`}>
      <div className="pointer-events-none absolute inset-0 fx-scanline opacity-25" />
      {header ? (
        <header className="relative border-b border-ink-line px-5 py-3">
          <span className="font-mono text-caption uppercase tracking-label text-ink-text">{header}</span>
        </header>
      ) : null}
      <div className="relative p-5">{children}</div>
    </section>
  );
}

// Terminal-style command display
function TerminalCommand({ command, copied, onCopy, label, helper }) {
  return (
    <div className="space-y-3">
      {label && (
        <p className="text-micro uppercase tracking-caps text-ink-muted font-mono">
          {label}
        </p>
      )}
      <div className="relative">
        <div className="relative flex items-center gap-0 border border-ink-muted bg-surface/80">
          <div className="shrink-0 px-3 py-3 border-r border-ink-line bg-ink-muted">
            <span className="text-ink font-mono text-body">$</span>
          </div>

          <div className="flex-1 min-w-0 px-4 py-3 overflow-x-auto">
            <code className="font-mono text-body text-ink whitespace-nowrap block">
              {command}
            </code>
          </div>

          <button
            type="button"
            onClick={onCopy}
            className="shrink-0 px-4 py-3 border-l border-ink-line text-ink-text hover:text-ink hover:bg-ink-faint transition-colors duration-200"
            title={copied ? "Copied!" : "Copy to clipboard"}
          >
            {copied ? (
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
                <path d="M6 10.5L3.5 8l-1 1L6 13l7-7-1-1-6 5.5z" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="5" y="5" width="8" height="8" rx="1" />
                <path d="M3 11V3h8" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
      
      {helper && (
        <p className="text-micro uppercase tracking-label text-ink-muted font-mono pl-1">
          {helper}
        </p>
      )}
    </div>
  );
}

export function LandingView({
  copy,
  appVersion,
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
  const [aiAgentCopied, setAiAgentCopied] = useState(false);
  
  const handleAiAgentCopy = () => {
    navigator.clipboard.writeText(copy("landing.ai_agent.guide_url"));
    setAiAgentCopied(true);
    setTimeout(() => setAiAgentCopied(false), 2000);
  };
  const extrasSkeleton = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
      <div className="h-44 border border-ink-faint bg-ink-faint animate-pulse" />
      <div className="h-44 border border-ink-faint bg-ink-faint animate-pulse" />
    </div>
  );

  return (
    <div className="min-h-screen bg-surface font-mono text-ink flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-ink selection:text-surface">
      {/* Animated grid background */}
      <div className="fixed inset-0 z-0 opacity-20">
        <div className="absolute inset-0 fx-grid" />
      </div>
      
      {effectsReady ? (
        <Suspense fallback={null}>
          <MatrixRain />
        </Suspense>
      ) : null}
      
      {/* Header */}
      <div className="fixed top-4 sm:top-6 right-4 sm:right-6 z-[70] flex items-center gap-3">
        <GithubStar isFixed={false} size="header" />
        <MatrixButton as="a" href={signUpUrl} size="header" variant="primary">
          <span className="font-mono font-bold text-caption tracking-label text-surface uppercase">
            {copy("landing.nav.login_signup")}
          </span>
        </MatrixButton>
      </div>
      
      {/* CRT scanline overlay — single source (DESIGN.md §5). */}
      <div className="pointer-events-none fixed inset-0 z-50 fx-scanline" />

      {/* Main content */}
      <main className="w-full max-w-4xl relative z-10 flex flex-col items-center space-y-8 sm:space-y-12 py-8 sm:py-12">
        
        {/* Hero section */}
        <div className="text-center space-y-6">
          <h1 className="text-display-2 sm:text-display-1 md:text-display-1 font-black text-ink-bright tracking-tight leading-none select-none">
            <DecodingText text={copy("landing.hero.title_primary")} /> <br />
            <span className="text-ink">
              <DecodingText text={copy("landing.hero.title_secondary")} />
            </span>
          </h1>

          <div className="flex flex-col items-center space-y-4">
            <ClientLogoRow />
            <p className="text-caption sm:text-body text-ink-text uppercase tracking-caps max-w-lg text-center">
              {copy("landing.hero.subtagline")}
            </p>
          </div>
        </div>

        {/* Landing extras */}
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

        {/* AI Agent Install Card */}
        <MatrixCard className="w-full max-w-2xl" header={copy("landing.ai_agent.title")}>
          <div className="space-y-4">
            <p className="text-body text-ink-text leading-relaxed">
              {copy("landing.ai_agent.description")}
            </p>
            
            <TerminalCommand
              command={copy("landing.ai_agent.command")}
              copied={aiAgentCopied}
              onCopy={handleAiAgentCopy}
              helper={copy("landing.ai_agent.helper")}
            />
          </div>
        </MatrixCard>

        {/* Quick Install Card */}
        <MatrixCard className="w-full max-w-2xl" header={copy("landing.install.title")}>
          <TerminalCommand
            command={installCommand}
            copied={installCopied}
            onCopy={onCopyInstallCommand}
            label={copy("landing.install.prompt")}
            helper={copy("landing.install.helper")}
          />
        </MatrixCard>

        {/* Screenshot */}
        <MatrixCard className="w-full max-w-4xl" header={copy("landing.screenshot.title")}>
          <div className="relative overflow-hidden border border-ink-muted bg-surface/60">
            <img
              src="/landing-dashboard.jpg"
              alt={copy("landing.screenshot.alt")}
              className="block w-full h-auto"
              loading="lazy"
              decoding="async"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-ink-faint via-transparent to-transparent" />
          </div>
        </MatrixCard>

        {/* Features Card */}
        <MatrixCard className="w-full max-w-2xl" header={copy("landing.features.title")}>
          <div className="space-y-5">
            <h2 className="text-heading sm:text-display-3 font-bold text-ink tracking-tight">
              {copy("landing.seo.title")}
            </h2>
            <p className="text-body text-ink-text leading-relaxed">
              {copy("landing.seo.summary")}
            </p>
            <ul className="space-y-3">
              {[copy("landing.seo.point1"), copy("landing.seo.point2"), copy("landing.seo.point3")].map((point, i) => (
                <li key={i} className="flex items-start gap-3 text-body text-ink-text">
                  <span className="shrink-0 text-ink font-mono text-caption mt-0.5">[{i + 1}]</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <div className="pt-3 border-t border-ink-line">
              <p className="text-micro uppercase tracking-caps text-ink-muted">
                {copy("landing.seo.roadmap")}
              </p>
            </div>
          </div>
        </MatrixCard>

        {/* CTA */}
        <div className="w-full max-w-sm">
          <a
            href={signUpUrl}
            className="group relative block w-full text-center overflow-hidden"
          >
            {/* Button background */}
            <div className="relative bg-ink text-surface font-black uppercase tracking-caps py-4 px-6 hover:bg-ink-bright transition-colors duration-200">
              <span className="relative z-10">{copy("landing.cta.primary")}</span>
            </div>
            <div className="px-4 pt-3 text-micro uppercase tracking-caps text-ink-text">
              {copy("landing.cta.secondary")}
            </div>
            
            {/* Bottom scanline */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-surface/20" />
          </a>
        </div>
        
        {/* Footer status line */}
        <div className="flex items-center gap-4 text-micro uppercase tracking-caps text-ink-muted">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-ink-text rounded-full animate-pulse" />
            v{appVersion || "unknown"}
          </span>
          <span>|</span>
          <span>{copy("landing.footer.system_ready")}</span>
        </div>
      </main>
      
      {/* Add scan animation keyframes */}
      <style>{`
        @keyframes scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-scan {
          animation: scan 3s linear infinite;
        }
      `}</style>
    </div>
  );
}
