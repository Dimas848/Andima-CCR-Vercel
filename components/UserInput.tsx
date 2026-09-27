"use client";

import React, { forwardRef, useState } from "react";

export type InputState = "default" | "hover" | "focus" | "filled" | "disabled" | "error" | "success";

export interface UserInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Explicit visual state variant override.
   * If omitted, the state will be computed dynamically from interactive events (hover, focus, disabled, value, error, success).
   */
  variantState?: InputState;
  /**
   * Label displayed above the input field
   */
  label?: string;
  /**
   * Error message displayed below the input field and triggers error styling
   */
  errorMessage?: string;
  /**
   * Success message displayed below the input field and triggers success styling
   */
  successMessage?: string;
  /**
   * Helper text displayed below the input field
   */
  helperText?: string;
  /**
   * Optional custom right icon or element
   */
  rightIcon?: React.ReactNode;
  /**
   * Optional custom left icon or element
   */
  leftIcon?: React.ReactNode;
  /**
   * Show status icon (error exclamation / success checkmark) automatically based on state
   */
  showStatusIcon?: boolean;
  /**
   * Force error styling without requiring errorMessage
   */
  isError?: boolean;
  /**
   * Force success styling without requiring successMessage
   */
  isSuccess?: boolean;
  /**
   * Additional wrapper class names
   */
  containerClassName?: string;
}

// Crisp SVGs for the error and success icons matching the mockup
export const ErrorCircleIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2.5" />
  </svg>
);

export const SuccessCircleIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <polyline points="9 12 11.5 14.5 15.5 9.5" />
  </svg>
);

export const UserInput = forwardRef<HTMLInputElement, UserInputProps>(
  (
    {
      variantState,
      label,
      errorMessage,
      successMessage,
      helperText,
      rightIcon,
      leftIcon,
      showStatusIcon = true,
      isError = false,
      isSuccess = false,
      disabled = false,
      value,
      defaultValue,
      placeholder = "User Input D1",
      className = "",
      containerClassName = "",
      onFocus,
      onBlur,
      onMouseEnter,
      onMouseLeave,
      onChange,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [internalValue, setInternalValue] = useState<string>(
      (value as string) ?? (defaultValue as string) ?? ""
    );

    const hasValue = value !== undefined ? Boolean(value) : Boolean(internalValue);
    const isDisabled = disabled || variantState === "disabled";
    const hasError = Boolean(errorMessage) || isError || variantState === "error";
    const hasSuccess = (Boolean(successMessage) || isSuccess || variantState === "success") && !hasError;

    // Determine effective styling state
    const effectiveState: InputState = (() => {
      if (variantState) return variantState;
      if (isDisabled) return "disabled";
      if (hasError) return "error";
      if (hasSuccess) return "success";
      if (isFocused) return "focus";
      if (isHovered) return "hover";
      if (hasValue) return "filled";
      return "default";
    })();

    // State-specific border & background styles matching design:
    // - Default: light grey border (#D1D5DB / border-gray-300), bg-white, text-gray-400 placeholder
    // - Hover: darker grey border (#64748B / border-gray-500), bg-white
    // - Focus/Ketik: 2px bold dark border (border-2 border-black or border-gray-900), text dark
    // - Filled: light/medium border (#D1D5DB / border-gray-400), text dark bold
    // - Disabled: solid light grey filled background (#ECEEF2 / bg-slate-100), subtle border, muted text
    // - Error: red border (#DC2626 / border-red-600), text red, right icon red
    // - Success: dark navy/slate border (#334155 / border-slate-700), text slate-700, right icon slate-700
    const getContainerStyles = () => {
      switch (effectiveState) {
        case "disabled":
          return "bg-[#ECEEF2] border border-transparent text-[#64748B] cursor-not-allowed";
        case "error":
          return "bg-white border border-[#DC2626] text-[#DC2626] focus-within:ring-1 focus-within:ring-[#DC2626]";
        case "success":
          return "bg-white border border-[#334155] text-[#334155] focus-within:ring-1 focus-within:ring-[#334155]";
        case "focus":
          return "bg-white border-2 border-black text-black shadow-sm";
        case "hover":
          return "bg-white border border-[#64748B] text-gray-900";
        case "filled":
          return "bg-white border border-gray-300 text-gray-900";
        case "default":
        default:
          return "bg-white border border-gray-300 text-gray-900 hover:border-[#64748B] focus-within:border-2 focus-within:border-black";
      }
    };

    const getInputStyles = () => {
      switch (effectiveState) {
        case "disabled":
          return "text-[#64748B] placeholder:text-[#64748B] cursor-not-allowed font-normal";
        case "error":
          return "text-[#DC2626] placeholder:text-[#DC2626]/70 font-normal";
        case "success":
          return "text-[#334155] placeholder:text-[#334155]/70 font-normal";
        case "focus":
          return "text-black placeholder:text-gray-400 font-medium";
        case "filled":
          return "text-gray-900 placeholder:text-gray-400 font-semibold";
        case "hover":
          return "text-gray-800 placeholder:text-gray-500 font-normal";
        case "default":
        default:
          return "text-gray-900 placeholder:text-gray-400 font-normal";
      }
    };

    // Determine status icon
    let statusIconNode: React.ReactNode = null;
    if (showStatusIcon) {
      if (effectiveState === "error" || hasError) {
        statusIconNode = <ErrorCircleIcon className="w-5 h-5 text-[#DC2626] shrink-0" />;
      } else if (effectiveState === "success" || hasSuccess) {
        statusIconNode = <SuccessCircleIcon className="w-5 h-5 text-[#334155] shrink-0" />;
      }
    }

    return (
      <div className={`w-full flex flex-col gap-1.5 ${containerClassName}`}>
        {label && (
          <label className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}

        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`relative flex items-center w-full min-h-[46px] px-3.5 py-2 rounded-lg transition-all duration-150 ${getContainerStyles()}`}
        >
          {leftIcon && <div className="mr-2.5 flex items-center shrink-0">{leftIcon}</div>}

          <input
            ref={ref}
            type="text"
            disabled={isDisabled}
            placeholder={placeholder}
            value={value}
            defaultValue={defaultValue}
            onChange={(e) => {
              setInternalValue(e.target.value);
              onChange?.(e);
            }}
            onFocus={(e) => {
              setIsFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className={`w-full bg-transparent outline-none border-none text-[15px] leading-relaxed transition-colors ${getInputStyles()} ${className}`}
            {...props}
          />

          {rightIcon ? (
            <div className="ml-2 flex items-center shrink-0">{rightIcon}</div>
          ) : (
            statusIconNode && <div className="ml-2 flex items-center shrink-0">{statusIconNode}</div>
          )}
        </div>

        {/* Feedback helper/error/success text */}
        {errorMessage ? (
          <p className="text-xs text-[#DC2626] font-medium mt-0.5">{errorMessage}</p>
        ) : successMessage ? (
          <p className="text-xs text-[#334155] font-medium mt-0.5">{successMessage}</p>
        ) : helperText ? (
          <p className="text-xs text-gray-500 mt-0.5">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

UserInput.displayName = "UserInput";

export default UserInput;
