"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "ghost";
type Size = "md" | "sm";

interface CustomButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantStyles: Record<Variant, string> = {
  primary: "bg-[#0a7ebf] text-white hover:bg-[#08689d]",
  outline: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100",
};

const sizeStyles: Record<Size, string> = {
  md: "px-4 py-2.5 text-sm",
  sm: "px-3 py-1.5 text-xs",
};

export default function CustomButton({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: CustomButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold shadow-sm transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}