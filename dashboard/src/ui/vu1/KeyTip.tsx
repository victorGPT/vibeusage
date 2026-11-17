import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-sdk/react/tooltip";
import type { ComponentProps } from "react";

// An icon key's name, shown while it is hovered or focused (DESIGN.md "Tooltip"). The key stays the trigger.
// `toggleable` also opens it on a press, the only way a touch screen can.
export function KeyTip({ label, toggleable, children }: { label: string; toggleable?: boolean; children: ComponentProps<typeof TooltipTrigger>["render"] }) {
  return (
    <Tooltip toggleable={toggleable}>
      <TooltipTrigger render={children} />
      <TooltipContent data-kit="tooltip">{label}</TooltipContent>
    </Tooltip>
  );
}
