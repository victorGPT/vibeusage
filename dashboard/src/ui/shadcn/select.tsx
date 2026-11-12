import { Select as SelectPrimitive } from "@base-ui/react/select";

import { cn } from "#src/lib/utils.ts";

// SSOT: design/2049/source/Select.dc.html. The board draws the closed control; the open panel
// reuses its border, fill and label type. Pass `items` to <Select> so the trigger echoes the label.
const Select = SelectPrimitive.Root;

const CONTROL_TEXT = "font-sans text-[11px]/none font-semibold uppercase tracking-label";

function SelectValue(props: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({ className, children, ...props }: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        CONTROL_TEXT,
        "inline-flex h-control cursor-pointer items-center gap-2 rounded-sm border border-input bg-background px-3 whitespace-nowrap text-foreground outline-none is-hover:border-teal data-disabled:cursor-default data-disabled:opacity-45 is-focus:outline-2 is-focus:outline-solid is-focus:outline-offset-2 is-focus:outline-ring",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="flex text-muted-foreground">
        <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3 fill-none stroke-current">
          <path d="M3 4.5 6 7.5 9 4.5" />
        </svg>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({ className, children, ...props }: SelectPrimitive.Popup.Props) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner alignItemWithTrigger={false} sideOffset={4} align="start" className="z-50 outline-none">
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "max-h-(--available-height) min-w-(--anchor-width) overflow-y-auto rounded-sm border border-input bg-background py-1 outline-none",
            className,
          )}
          {...props}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({ className, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        CONTROL_TEXT,
        "flex h-control cursor-pointer items-center px-3 text-foreground outline-none select-none data-disabled:cursor-default data-disabled:opacity-45 data-highlighted:bg-card data-highlighted:text-hero data-selected:text-primary",
        className,
      )}
      {...props}
    />
  );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
