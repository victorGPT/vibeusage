import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

// Dev-only token gallery mounted at /__2049 (see main.jsx). Every label is a token name or a
// value read back from the rendered element, so this page shows what the CSS actually does.

// Class names stay literal: Tailwind only generates utilities it finds spelled out in source.
const COLORS = [
  ["background", "bg-background"],
  ["card", "bg-card"],
  ["border", "bg-border"],
  ["input", "bg-input"],
  ["muted-foreground", "bg-muted-foreground"],
  ["foreground", "bg-foreground"],
  ["hero", "bg-hero"],
  ["primary", "bg-primary"],
  ["primary-foreground", "bg-primary-foreground"],
  ["destructive", "bg-destructive"],
  ["ring", "bg-ring"],
  ["teal", "bg-teal"],
  ["screen-core", "bg-screen-core"],
  ["screen-edge", "bg-screen-edge"],
] as const;

const TYPE = [
  ["font-display 200", "font-display font-extralight text-[64px]/none text-hero", "4,733"],
  ["font-display 300", "font-display font-light text-[28px]/none text-hero", "$1,456.46"],
  ["font-display 400", "font-display font-normal text-[18px]/none text-hero", "195.9M"],
  ["font-sans 500", "font-sans font-medium text-[15px]/[1.4]", "Codex · Claude Code"],
  ["font-sans 600 label", "font-sans font-semibold text-[11px]/none tracking-label uppercase text-muted-foreground", "Week rank"],
  ["font-command 500", "font-command font-medium text-[14px]/none text-hero", "npx --yes vibeusage init"],
] as const;

const FONT_FACES = [
  "200 16px Saira",
  "300 16px Saira",
  "400 16px Saira",
  "500 16px Barlow",
  "600 16px Barlow",
  "500 16px 'JetBrains Mono'",
];

const RADII = [
  ["rounded-sm", "rounded-sm w-18 h-8"],
  ["rounded-md", "rounded-md w-24 h-16 bg-card"],
  ["rounded-lg", "rounded-lg w-30 h-20 bg-screen-core"],
] as const;

const SPACING = [
  ["1", "w-1"],
  ["2", "w-2"],
  ["3", "w-3"],
  ["4", "w-4"],
  ["6", "w-6"],
  ["8", "w-8"],
  ["12", "w-12"],
  ["16", "w-16"],
] as const;

const SIZES = ["h-control", "h-control-lg", "h-row"] as const;

function Sample({ className, prop }: { className: string; prop: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  useLayoutEffect(() => {
    if (ref.current) setValue(getComputedStyle(ref.current).getPropertyValue(prop));
  }, [prop]);
  return (
    <>
      <div ref={ref} className={className} />
      <span className="text-[12px] text-muted-foreground" data-readout={prop}>
        {value}
      </span>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-6">
      <h2 className="font-sans text-[11px]/none font-semibold uppercase tracking-label text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Gallery2049() {
  const [fonts, setFonts] = useState("");
  useEffect(() => {
    document.fonts.ready.then(() => setFonts(FONT_FACES.map((f) => `${f}=${document.fonts.check(f)}`).join("  ")));
  }, []);

  return (
    <main className="min-h-screen bg-background px-4 py-8 font-sans text-[15px] font-medium text-foreground md:px-8">
      <div className="mx-auto flex max-w-[1216px] flex-col gap-8">
        <h1 className="font-display text-[44px]/none font-extralight text-hero">{"/__2049"}</h1>

        <Section title="color">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
            {COLORS.map(([name, className]) => (
              <div key={name} className="flex flex-col gap-2" data-token={`--color-${name}`}>
                <Sample prop="background-color" className={`h-12 rounded-sm border border-border ${className}`} />
                <span className="text-[12px]">{name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="type">
          <span className="text-[12px] text-muted-foreground" data-fonts>
            {fonts}
          </span>
          <div className="flex flex-col gap-4">
            {TYPE.map(([name, className, sample]) => (
              <div key={name} className="flex flex-col gap-2">
                <div className={`wrap-anywhere ${className}`}>{sample}</div>
                <span className="text-[12px] text-muted-foreground">{name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="radius">
          <div className="flex flex-wrap items-end gap-4">
            {RADII.map(([name, className]) => (
              <div key={name} className="flex flex-col items-center gap-2" data-token={name}>
                <Sample prop="border-radius" className={`border border-input ${className}`} />
                <span className="text-[12px]">{name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="spacing">
          <div className="flex flex-col gap-2">
            {SPACING.map(([step, className]) => (
              <div key={step} className="flex items-center gap-3" data-token={`spacing-${step}`}>
                <Sample prop="width" className={`h-2 bg-primary ${className}`} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="size">
          <div className="flex flex-wrap items-end gap-4">
            {SIZES.map((name) => (
              <div key={name} className="flex flex-col gap-2" data-token={name}>
                <Sample prop="height" className={`w-24 rounded-sm border border-input ${name}`} />
                <span className="text-[12px]">{name}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </main>
  );
}
