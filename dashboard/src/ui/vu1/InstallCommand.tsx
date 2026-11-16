import { useState } from "react";

import { copy } from "#src/lib/copy.ts";
import { Button } from "#src/ui/hardware/button.tsx";
import { haptic } from "#src/ui/hardware/lib/haptics.ts";
import "./blocks.css";

export function InstallCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  // A missing or blocked clipboard keeps the Copy label, so the user can still select the text.
  const press = () => {
    navigator.clipboard?.writeText(command).then(
      () => {
        haptic("success");
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      },
      () => {},
    );
  };
  return (
    <div data-vu1="screen" data-variant="cmd">
      <code>
        <span data-vu1="prompt">{copy("vu1.install.prompt")}</span> <span>{command}</span>
      </code>
      <Button data-vu1-cap="" onClick={press}>
        {copied ? copy("vu1.install.copied") : copy("vu1.install.copy")}
      </Button>
    </div>
  );
}
