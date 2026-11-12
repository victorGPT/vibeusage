import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "#src/lib/utils.ts";

// SSOT: design/2049/source/Switch.dc.html. Children are the visible label, inside the root so the
// focus ring wraps track and label together. Disabled follows the source: a dimmed track, the whole control at 60%.
function Switch({ className, children, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "group/switch inline-flex w-fit cursor-pointer items-center gap-2 rounded-sm font-sans text-[11px]/none font-semibold uppercase tracking-label text-muted-foreground outline-none data-disabled:cursor-default data-disabled:opacity-60 data-unchecked:is-hover:*:data-[slot=switch-track]:border-teal data-unchecked:is-hover:*:data-[slot=switch-track]:bg-card is-focus:outline-2 is-focus:outline-solid is-focus:outline-offset-2 is-focus:outline-ring",
        className,
      )}
      {...props}
    >
      <span
        data-slot="switch-track"
        className="relative inline-block h-5 w-10 flex-none rounded-sm border border-input bg-background transition-[background-color,border-color] duration-120 group-data-checked/switch:border-primary group-data-checked/switch:bg-primary group-data-disabled/switch:border-border group-data-disabled/switch:bg-transparent group-data-disabled/switch:group-data-checked/switch:border-input group-data-disabled/switch:group-data-checked/switch:bg-input"
      >
        <SwitchPrimitive.Thumb
          data-slot="switch-thumb"
          className="absolute top-0.5 left-0.5 size-3.5 rounded-[2px] bg-muted-foreground transition-[left] duration-120 data-checked:left-5.5 data-checked:bg-primary-foreground"
        />
      </span>
      {children}
    </SwitchPrimitive.Root>
  );
}

export { Switch };
