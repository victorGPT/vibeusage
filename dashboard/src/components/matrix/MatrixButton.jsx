import React from "react";

const MatrixButton = ({ children, primary, className = "", ...props }) => {
  const baseStyles =
    "appearance-none border text-[#00FF41] px-4 py-2 font-mono font-bold text-xs uppercase tracking-wider cursor-pointer transition-all duration-200 flex items-center justify-center gap-2 group relative overflow-hidden";

  const primaryStyles =
    "bg-[#00FF41]/10 border-[#00FF41] hover:bg-[#00FF41]/20 shadow-[0_0_10px_rgba(0,255,65,0.2)]";
  const defaultStyles =
    "bg-transparent border-[#00FF41]/30 hover:bg-[#00FF41]/10 hover:border-[#00FF41]/60";
  const disabledStyles = "opacity-50 cursor-not-allowed hover:bg-transparent";

  return (
    <button
      className={`${baseStyles} ${primary ? primaryStyles : defaultStyles} ${
        props.disabled ? disabledStyles : ""
      } ${className}`}
      {...props}
    >
      <span className="relative z-10 flex items-center gap-2">
        <span className="opacity-50 group-hover:opacity-100 transition-opacity">
          [
        </span>
        {children}
        <span className="opacity-50 group-hover:opacity-100 transition-opacity">
          ]
        </span>
      </span>
    </button>
  );
};

export default MatrixButton;
