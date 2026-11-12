import { useState } from "react";

import { copy } from "#src/lib/copy.ts";
import { safeGetItem, safeSetItem } from "#src/lib/safe-browser.ts";
import { CommandBox } from "#src/ui/2049/base/CommandBox.tsx";
import { Label } from "#src/ui/2049/base/Label.tsx";
import { Text } from "#src/ui/2049/base/Text.tsx";
import { Button } from "#src/ui/shadcn/button.tsx";

// Keeps the old banner's dismiss keys, so readers who dismissed a version stay dismissed.
function dismissKey(version: string) {
  return version ? `vibeusage_upgrade_dismissed_${version}` : "vibeusage_upgrade_dismissed_unknown";
}

// In the page flow above the TopNav: it pushes the page down instead of covering it.
export function UpgradeBanner({ requiredVersion }: { requiredVersion?: string | null }) {
  const version = typeof requiredVersion === "string" ? requiredVersion.trim() : "";
  const key = dismissKey(version);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  if (dismissedKey === key || safeGetItem(key)) return null;

  const title = copy("dashboard.upgrade_alert.title");
  const dismiss = () => {
    safeSetItem(key, "true");
    setDismissedKey(key);
  };
  return (
    <section aria-label={title} className="border-b border-border bg-card px-8 py-3">
      <div className="mx-auto flex max-w-304 flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Label text={title} tone="accent" />
          <Text
            text={
              version
                ? copy("dashboard.upgrade_alert.subtitle", { required: version })
                : copy("dashboard.upgrade_alert.subtitle_generic")
            }
            size="s"
          />
        </div>
        <div className="min-w-0 flex-auto sm:max-w-xl">
          <CommandBox
            command={copy("dashboard.upgrade_alert.install_command")}
            prefix={copy("dashboard.upgrade_alert.prompt")}
          />
        </div>
        <Button variant="ghost" onClick={dismiss}>
          {copy("dashboard.upgrade_alert.ignore")}
        </Button>
      </div>
    </section>
  );
}
