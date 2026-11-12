import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "#src/lib/utils.ts";

// SSOT: design/2049/source/Button.dc.html. Disabled keeps the variant look at 45% opacity.
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-sm border font-sans font-semibold whitespace-nowrap uppercase tracking-label no-underline transition-[background-color,border-color] duration-120 select-none outline-none is-focus:outline-2 is-focus:outline-solid is-focus:outline-offset-2 is-focus:outline-ring disabled:cursor-default disabled:opacity-45 data-disabled:cursor-default data-disabled:opacity-45",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground is-hover:brightness-112 is-active:brightness-90",
        outline:
          "border-input bg-transparent text-foreground is-hover:border-teal is-hover:bg-card is-hover:text-hero is-active:border-teal is-active:bg-accent is-active:text-hero",
        ghost:
          "border-transparent bg-transparent text-foreground is-hover:bg-card is-hover:text-hero is-active:bg-accent is-active:text-hero",
      },
      size: {
        default: "h-control px-4 text-[11px]/none",
        lg: "h-control-lg px-6 text-[12px]/none",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
