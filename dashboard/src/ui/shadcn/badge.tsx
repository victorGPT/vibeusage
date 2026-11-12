import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "#src/lib/utils.ts";

// SSOT: design/2049/source/Badge.dc.html. Both variants share one size so a badge never reads
// as a button; only the color differs.
const badgeVariants = cva(
  "inline-block max-w-full shrink-0 overflow-hidden rounded-sm border px-2 py-1 align-middle font-sans text-[10px]/none font-semibold text-ellipsis whitespace-nowrap uppercase tracking-label",
  {
    variants: {
      variant: {
        outline: "border-input text-foreground",
        accent: "border-teal text-teal",
      },
    },
    defaultVariants: {
      variant: "outline",
    },
  },
);

function Badge({
  className,
  variant = "outline",
  render,
  ...props
}: useRender.ComponentProps<"span"> & { variant?: VariantProps<typeof badgeVariants>["variant"] }) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">({ className: cn(badgeVariants({ variant }), className) }, props),
    render,
    state: { slot: "badge", variant },
  });
}

export { Badge, badgeVariants };
