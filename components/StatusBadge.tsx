"use client";

import React from "react";

export type StatusVariant = "ok" | "warning" | "error" | "success";

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: StatusVariant;
  children?: React.ReactNode;
  fullWidth?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = "ok",
  children,
  fullWidth = true,
  className = "",
  ...props
}) => {
  const getStatusStyles = () => {
    switch (status) {
      case "warning":
        return "bg-[#D68A12] text-white";
      case "error":
        return "bg-[#D72C46] text-white";
      case "ok":
      case "success":
      default:
        return "bg-[#179C77] text-white";
    }
  };

  const getDefaultText = () => {
    switch (status) {
      case "warning":
        return "Warning!";
      case "error":
        return "Error";
      case "ok":
      case "success":
      default:
        return "OK!";
    }
  };

  return (
    <div
      className={`h-[56px] px-6 rounded-2xl font-bold text-xl tracking-tight flex items-center justify-center select-none shadow-xs transition-colors ${
        fullWidth ? "w-full" : "w-auto"
      } ${getStatusStyles()} ${className}`}
      {...props}
    >
      {children ?? getDefaultText()}
    </div>
  );
};

export default StatusBadge;
