import { useState } from "react";

import { copy } from "#src/lib/copy.ts";
import { Button } from "#src/ui/shadcn/button.tsx";

// SSOT: design/2049/source/CommandBox.dc.html.
export function CommandBox({ command, prefix = "$" }: { command: string; prefix?: string }) {
  // Remember which command was copied, so a new command shows Copy again.
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const copied = copiedCommand === command;
  const onCopy = () => {
    // A blocked clipboard keeps the Copy label, so the user can still select the text.
    navigator.clipboard?.writeText(command).then(
      () => setCopiedCommand(command),
      () => {},
    );
  };
  return (
    <div className="flex w-full items-stretch rounded-sm border border-input">
      <code className="min-w-0 flex-auto px-4 py-3 font-command text-copy-m/6 font-medium wrap-anywhere text-hero">
        <span className="text-muted-foreground">{`${prefix}\u00a0`}</span>
        {command}
      </code>
      <div className="flex items-center border-l border-input px-1">
        <Button variant="ghost" onClick={onCopy}>
          {copied ? copy("ui2049.command_box.copied") : copy("ui2049.command_box.copy")}
        </Button>
      </div>
      {/* Stays mounted so screen readers hear the change, not a new region. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? copy("ui2049.command_box.copied") : ""}
      </span>
    </div>
  );
}
