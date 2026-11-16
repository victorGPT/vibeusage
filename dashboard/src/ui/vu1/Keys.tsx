import { Terminal, Upload } from "@carbon/icons-react";
import type { ReactNode } from "react";

import { copy } from "#src/lib/copy.ts";
import { Button } from "#src/ui/hardware/button.tsx";
import "./blocks.css";

type RoundKeyProps = { label: string; legend: string; tone: "primary" | "secondary"; icon: ReactNode; onPress: () => void; busy?: boolean };

function RoundKey({ label, legend, tone, icon, onPress, busy = false }: RoundKeyProps) {
  return (
    <div data-vu1="keycol">
      <Button
        tone={tone}
        round
        aria-label={label}
        aria-busy={busy || undefined}
        onClick={() => {
          if (!busy) onPress();
        }}
      >
        {icon}
      </Button>
      <span data-vu1="legend" aria-hidden>
        {legend}
      </span>
    </div>
  );
}

// The page passes its screenshot capture as onPress and holds the key with busy while it runs.
export function ShareKey({ onPress, busy }: { onPress: () => void; busy?: boolean }) {
  return (
    <RoundKey
      label={copy("vu1.keys.share_aria")}
      legend={copy("vu1.keys.share")}
      tone="primary"
      icon={<Upload size={20} />}
      onPress={onPress}
      busy={busy}
    />
  );
}

export function InstallKey({ onPress }: { onPress: () => void }) {
  return (
    <RoundKey
      label={copy("vu1.keys.install_aria")}
      legend={copy("vu1.keys.install")}
      tone="secondary"
      icon={<Terminal size={20} />}
      onPress={onPress}
    />
  );
}
