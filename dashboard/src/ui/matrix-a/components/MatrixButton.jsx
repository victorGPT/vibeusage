import React from "react";

export function MatrixButton({
  as: Comp = "button",
  children,
  primary = false,
  className = "",
  ...props
}) {
  const base =
    "inline-flex items-center justify-center px-3 py-2 border font-black uppercase tracking-widest text-[10px] transition-colors select-none";
  const variant = primary
    ? "bg-[#00FF41] text-black border-[#00FF41] hover:bg-white hover:border-white"
    : "bg-[#00FF41]/5 text-[#00FF41] border-[#00FF41]/30 hover:bg-[#00FF41]/15";
  const disabled =
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#00FF41]/5";

  return (
    <Comp className={`${base} ${variant} ${disabled} ${className}`} {...props}>
      {children}
    </Comp>
  );
}
