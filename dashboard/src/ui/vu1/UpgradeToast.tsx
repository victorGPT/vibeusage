import { useState } from "react";

import { copy } from "#src/lib/copy.ts";
import { safeGetItem, safeSetItem } from "#src/lib/safe-browser.ts";
import { Button } from "#src/ui/hardware/button.tsx";
import "./blocks.css";

// The 2049 banner's dismiss keys, so a version dismissed there stays dismissed here.
function dismissKey(version: string) {
  return version ? `vibeusage_upgrade_dismissed_${version}` : "vibeusage_upgrade_dismissed_unknown";
}

// Bottom-right note that a newer CLI is out. Update runs onUpdate (the page copies the upgrade
// command) and dismisses this version for good.
export function UpgradeToast({ requiredVersion, onUpdate }: { requiredVersion?: string | null; onUpdate?: () => void }) {
  const version = typeof requiredVersion === "string" ? requiredVersion.trim() : "";
  const key = dismissKey(version);
  const [dismissedKey, setDismissedKey] = useState(null as string | null);
  if (dismissedKey === key || safeGetItem(key)) return null;
  const update = () => {
    onUpdate?.();
    safeSetItem(key, "true");
    setDismissedKey(key);
  };
  return (
    <div role="status" data-vu1="toast" data-vu1-cap="">
      <span data-vu1="led" data-on="" aria-hidden />
      <span>{version ? copy("vu1.toast.available", { version }) : copy("vu1.toast.available_generic")}</span>
      <Button onClick={update}>{copy("vu1.toast.update")}</Button>
    </div>
  );
}
