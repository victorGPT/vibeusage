import { copy } from "#src/lib/copy.ts";
import { cn } from "#src/lib/utils.ts";
import { Heading } from "#src/ui/2049/base/Heading.tsx";
import { Label } from "#src/ui/2049/base/Label.tsx";
import { Button } from "#src/ui/shadcn/button.tsx";
import { Switch } from "#src/ui/shadcn/switch.tsx";

import { identicon } from "./derive";

type IdentityBarProps = {
  handle: string;
  since?: string;
  activeDays?: number;
  owner: boolean;
  publicEnabled?: boolean;
  publicBusy?: boolean;
  onPublicChange?: (value: boolean) => void;
  onCopyShareLink?: () => void;
  shareCopied?: boolean;
};

// SSOT: design/2049/source/IdentityBar.dc.html.
export function IdentityBar(props: IdentityBarProps) {
  const { handle, since, activeDays, owner, publicEnabled = false, publicBusy, onPublicChange } = props;
  return (
    <div className="flex min-h-18 w-full flex-wrap items-center gap-x-4 gap-y-3">
      <div aria-hidden="true" className="grid size-9 flex-none grid-cols-5 rounded-sm border border-input p-1">
        {identicon(handle).map((on, i) => (
          <i key={i} className={cn("block", on && "bg-primary")} />
        ))}
      </div>
      <Heading text={handle} size="xs" level={2} />
      {since && activeDays != null ? (
        <Label text={copy("ui2049.identity_bar.since", { since, days: activeDays })} />
      ) : null}
      <div className="ml-auto flex flex-wrap items-center gap-4">
        {owner ? (
          <>
            <Switch checked={publicEnabled} disabled={publicBusy} onCheckedChange={(v) => onPublicChange?.(v)}>
              {copy("ui2049.identity_bar.public")}
            </Switch>
            <Button variant="outline" disabled={!publicEnabled} onClick={props.onCopyShareLink}>
              {props.shareCopied ? copy("ui2049.command_box.copied") : copy("ui2049.identity_bar.copy_link")}
            </Button>
          </>
        ) : (
          <Label text={copy("ui2049.identity_bar.read_only")} />
        )}
      </div>
    </div>
  );
}
