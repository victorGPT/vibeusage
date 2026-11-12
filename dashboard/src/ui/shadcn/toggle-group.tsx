import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";

import { cn } from "#src/lib/utils.ts";

// SSOT: design/2049/source/ToggleGroup.dc.html. Without `multiple` it is a tab strip, so
// pressing the selected item again keeps it selected instead of emptying the group.
function ToggleGroup({ className, multiple, onValueChange, ...props }: ToggleGroupPrimitive.Props) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      multiple={multiple}
      onValueChange={(value, details) => {
        if (!multiple && value.length === 0) {
          details.cancel();
          return;
        }
        onValueChange?.(value, details);
      }}
      className={cn("flex flex-wrap gap-4", className)}
      {...props}
    />
  );
}

function ToggleGroupItem({ className, ...props }: TogglePrimitive.Props) {
  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={cn(
        "cursor-pointer rounded-none border-0 border-b border-transparent bg-transparent pb-2 font-sans text-[11px]/none font-semibold uppercase tracking-label text-muted-foreground outline-none not-data-pressed:is-hover:border-input not-data-pressed:is-hover:text-foreground data-pressed:border-primary data-pressed:text-primary is-focus:outline-2 is-focus:outline-solid is-focus:outline-offset-4 is-focus:outline-ring",
        className,
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
