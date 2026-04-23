import { Button } from "@base-ui/react/button";
import React from "react";

// MatrixButton — SSOT: DESIGN.md §6 MatrixButton.
// size:    sm | md | lg | header
// variant: primary | default | ghost

const SIZE = {
  sm: "h-7 px-3 text-micro",
  md: "h-9 px-4 text-caption",
  lg: "h-11 px-6 text-body",
  header: "text-caption tracking-label",
};

const VARIANT = {
  default:
    "bg-surface-raised text-ink border border-ink-line hover:bg-surface-strong hover:border-ink-muted",
  primary: "bg-ink text-surface border border-ink hover:bg-ink-bright hover:border-ink-bright",
  ghost: "bg-transparent text-ink border border-transparent hover:bg-ink-faint",
};

const VARIANT_HEADER = {
  default: "btn-chip",
  primary: "btn-chip btn-chip--primary",
  ghost: "btn-chip",
};

const BASE =
  "inline-flex items-center justify-center select-none uppercase " +
  "font-bold transition-colors active:scale-[0.98] " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-surface-raised";

export function MatrixButton({
  as: Comp = "button",
  children,
  primary = false,
  variant,
  size = "md",
  className = "",
  ...props
}) {
  // Back-compat: `primary` boolean flag resolves to variant="primary".
  const resolvedVariant = variant ?? (primary ? "primary" : "default");

  let finalClass;
  if (size === "header") {
    const chip = VARIANT_HEADER[resolvedVariant] ?? VARIANT_HEADER.default;
    finalClass = `${BASE} ${SIZE.header} ${chip} ${className}`.trim();
  } else {
    const sizeCls = SIZE[size] ?? SIZE.md;
    const variantCls = VARIANT[resolvedVariant] ?? VARIANT.default;
    finalClass = `${BASE} ${sizeCls} ${variantCls} ${className}`.trim();
  }

  if (Comp === "button") {
    return (
      <Button className={finalClass} {...props}>
        {children}
      </Button>
    );
  }

  const userRole = props.role;

  return (
    <Button
      className={finalClass}
      {...props}
      nativeButton={false}
      render={(renderProps) => {
        const { children: renderChildren, role: resolvedRole, ...rest } = renderProps;
        const role = Comp === "a" && userRole === undefined ? undefined : resolvedRole;
        return (
          <Comp {...rest} role={role}>
            {renderChildren}
          </Comp>
        );
      }}
    >
      {children}
    </Button>
  );
}
