import { Button } from "@base-ui/react/button";
import React from "react";
import { copy } from "../../../lib/copy";

export function BootScreen({ onSkip }) {
  const canSkip = Boolean(onSkip);

  const className = `min-h-screen bg-surface text-ink font-mono flex flex-col items-center justify-center p-8 text-center text-body ${
    canSkip ? "cursor-pointer" : ""
  }`;

  const content = (
    <>
      <pre className="text-caption leading-[1.2] mb-6 text-ink-text select-none">
        {copy("boot.ascii_art")}
      </pre>
      <div className="animate-pulse tracking-caps text-caption font-bold mb-4 uppercase">
        {copy("boot.prompt")}
      </div>
      <div className="w-64 h-1 bg-surface-strong relative overflow-hidden">
        <div className="absolute inset-0 bg-ink animate-[loader_2s_linear_infinite]"></div>
      </div>
      {canSkip ? (
        <p className="mt-6 text-caption text-ink-text uppercase">{copy("boot.skip_hint")}</p>
      ) : null}
      <style>{`@keyframes loader { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
    </>
  );

  if (!canSkip) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Button
      className={className}
      onClick={onSkip}
      aria-label={copy("boot.skip_aria")}
      nativeButton={false}
      render={(renderProps) => {
        const { children, ...rest } = renderProps;
        return <div {...rest}>{children}</div>;
      }}
    >
      {content}
    </Button>
  );
}
