"use client";

import React, { useState, useRef, useEffect } from "react";

export interface DropdownItem {
  id: string | number;
  label: string;
  subLabel?: string;
  badge?: string;
  selected?: boolean;
}

export interface CustomDropdownProps {
  label?: string;
  placeholder?: string;
  categoryTitle?: string;
  categoryBadge?: string;
  items?: DropdownItem[];
  value?: string | number;
  onChange?: (item: DropdownItem) => void;
  className?: string;
  defaultOpen?: boolean;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  label,
  placeholder = "Dropdown testing miliki C1",
  categoryTitle = "TESTING",
  categoryBadge = "3 Active",
  items = [
    { id: "node", label: "Node.js", subLabel: "v2.3.9" },
    { id: "react", label: "React.js", subLabel: "yes yes" },
    { id: "next", label: "Next.js", subLabel: "v2.4.1-rc" },
  ],
  value = "react",
  onChange,
  className = "",
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [selectedId, setSelectedId] = useState<string | number>(value);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find((item) => item.id === selectedId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (item: DropdownItem) => {
    setSelectedId(item.id);
    onChange?.(item);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full max-w-[340px] font-sans ${className}`}
    >
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger Box */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full bg-white border ${isOpen ? "border-slate-800 ring-1 ring-slate-800" : "border-slate-300 hover:border-slate-400"
          } rounded-lg px-4 py-3 text-left flex items-center justify-between shadow-xs transition-all duration-150`}
      >
        <span className="text-[15px] font-semibold text-slate-900 truncate">
          {placeholder}
        </span>
        <div className="flex items-center text-slate-500 shrink-0 ml-2">
          {isOpen ? (
            <svg
              className="w-4 h-4 text-slate-800 stroke-[2.5]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 text-slate-600 stroke-[2]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
            </svg>
          )}
        </div>
      </button>

      {/* Dropdown Menu Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden animate-in fade-in duration-100">
          {/* Header Row: Category & Active Count */}
          {(categoryTitle || categoryBadge) && (
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 text-xs">
              <span className="font-bold tracking-wider text-slate-500 uppercase">
                {categoryTitle}
              </span>
              <span className="text-slate-600 font-medium">{categoryBadge}</span>
            </div>
          )}

          {/* List Items */}
          <div className="py-1">
            {items.map((item) => {
              const isSelected = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={`w-full px-4 py-2.5 text-left flex items-center justify-between text-sm transition-colors ${isSelected
                      ? "bg-[#ECEEF2] text-slate-900 font-semibold"
                      : "text-slate-800 hover:bg-slate-50 font-semibold"
                    }`}
                >
                  <div className="flex items-center gap-2.5">
                    {isSelected ? (
                      <svg
                        className="w-4 h-4 text-slate-900 stroke-[2.5]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className="w-4" />
                    )}
                    <span className="text-[14px]">{item.label}</span>
                  </div>

                  {item.subLabel && (
                    <span
                      className={`text-xs font-normal ${isSelected ? "text-slate-700 font-medium" : "text-slate-600"
                        }`}
                    >
                      {item.subLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDropdown;
