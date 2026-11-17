import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-sdk/react/tooltip";
import type { ComponentProps } from "react";

// An icon key's name, shown while it is hovered or focused (DESIGN.md "Tooltip"). The key stays the trigger.
export function KeyTip({ label, children }: { label: string; children: ComponentProps<typeof TooltipTrigger>["render"] }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent data-kit="tooltip">{label}</TooltipContent>
    </Tooltip>
  );
}
