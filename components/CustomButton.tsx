"use client";

import React from "react";

export type ButtonVariant = "primary" | "outline" | "active" | "disabled";

export interface CustomButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children?: React.ReactNode;
  fullWidth?: boolean;
}

export const CustomButton: React.FC<CustomButtonProps> = ({
  variant = "primary",
  children = "Button",
  fullWidth = true,
  disabled = false,
  className = "",
  ...props
}) => {
  const isButtonDisabled = disabled || variant === "disabled";

  const getVariantStyles = () => {
    if (isButtonDisabled) {
      return "bg-[#CBD5E1] text-[#94A3B8] cursor-not-allowed shadow-none border border-transparent";
    }

    switch (variant) {
      case "outline":
        return "bg-[#F8F6FF] text-[#7A5AF8] border-2 border-[#7A5AF8] hover:bg-[#F0ECFF] shadow-xs active:scale-[0.98]";
      case "active":
        return "bg-[#663FE8] text-white shadow-md shadow-[#663FE8]/30 hover:bg-[#5B34DD] active:scale-[0.98] border border-transparent";
      case "primary":
      default:
        return "bg-[#7A5AF8] text-white shadow-md shadow-[#7A5AF8]/30 hover:bg-[#6C48F0] active:bg-[#6039E8] active:scale-[0.98] border border-transparent";
    }
  };

  return (
    <button
      disabled={isButtonDisabled}
      className={`h-[56px] px-6 rounded-2xl font-bold text-lg tracking-wide transition-all duration-150 flex items-center justify-center select-none ${
        fullWidth ? "w-full" : "w-auto"
      } ${getVariantStyles()} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default CustomButton;
