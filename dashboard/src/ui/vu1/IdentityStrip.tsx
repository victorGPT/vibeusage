import { copy } from "#src/lib/copy.ts";
import { Button } from "#src/ui/hardware/button.tsx";
import "./blocks.css";

type IdentityStripProps = {
  owner: boolean;
  since?: string | null;
  activeDays?: number;
  subscriptions?: string[];
  publicEnabled?: boolean;
  publicBusy?: boolean;
  shareCopied?: boolean;
  onPublicChange?: (enabled: boolean) => void;
  onCopyShareLink?: () => void;
};

// The meter's owner line: since when, plans, and the switch that publishes it at /share/<token>.
// A share visitor sees it marked read-only instead.
export function IdentityStrip({ owner, since, activeDays, subscriptions = [], publicEnabled = false, publicBusy = false, shareCopied = false, onPublicChange, onCopyShareLink }: IdentityStripProps) {
  return (
    <div data-vu1="identity" data-vu1-cap="" className="flex flex-wrap items-center justify-between gap-s4">
      <div className="flex flex-wrap items-center gap-s2">
        {since && activeDays != null ? <span>{copy("vu1.identity.since", { since, days: activeDays })}</span> : null}
        {subscriptions.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      {owner ? (
        <div className="ml-auto flex flex-wrap items-center gap-s2">
          <Button role="switch" aria-checked={publicEnabled} disabled={publicBusy} onClick={() => onPublicChange?.(!publicEnabled)}>
            <span data-vu1="led" data-on={publicEnabled || undefined} aria-hidden />
            {copy("vu1.identity.public")}
          </Button>
          <Button disabled={!publicEnabled || publicBusy} onClick={onCopyShareLink}>
            {shareCopied ? copy("vu1.identity.copied") : copy("vu1.identity.copy_link")}
          </Button>
        </div>
      ) : (
        <span className="ml-auto">{copy("vu1.identity.read_only")}</span>
      )}
    </div>
  );
}
