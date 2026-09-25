"use client";

import React, { useState } from "react";
import Pagination from "./Pagination";
import StatusBadge from "./StatusBadge";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  width?: string;
  render?: (row: T, index: number) => React.ReactNode;
}

export interface CustomTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor?: (item: T, index: number) => string | number;
  selectable?: boolean;
  selectedIds?: (string | number)[];
  onSelectChange?: (selectedIds: (string | number)[]) => void;
  // Pagination props
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
  className?: string;
}

export function CustomTable<T extends Record<string, any>>({
  columns,
  data,
  keyExtractor = (item, index) => item.id ?? index,
  selectable = false,
  selectedIds = [],
  onSelectChange,
  currentPage = 1,
  totalPages = 24,
  onPageChange,
  totalItems = 120,
  itemsPerPage = 5,
  className = "",
}: CustomTableProps<T>) {
  const [internalSelected, setInternalSelected] = useState<(string | number)[]>(selectedIds);

  const currentSelected = onSelectChange ? selectedIds : internalSelected;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = data.map((item, idx) => keyExtractor(item, idx));
      if (onSelectChange) {
        onSelectChange(allIds);
      } else {
        setInternalSelected(allIds);
      }
    } else {
      if (onSelectChange) {
        onSelectChange([]);
      } else {
        setInternalSelected([]);
      }
    }
  };

  const handleSelectRow = (id: string | number) => {
    let next: (string | number)[];
    if (currentSelected.includes(id)) {
      next = currentSelected.filter((item) => item !== id);
    } else {
      next = [...currentSelected, id];
    }
    if (onSelectChange) {
      onSelectChange(next);
    } else {
      setInternalSelected(next);
    }
  };

  const isAllSelected = data.length > 0 && data.every((item, idx) => currentSelected.includes(keyExtractor(item, idx)));

  return (
    <div className={`w-full bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden font-sans ${className}`}>
      {/* Table Content Wrapper */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse">
          {/* Table Header matching C1 / Pagination dark slate aesthetic */}
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-slate-200">
              {selectable && (
                <th className="w-12 px-4 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded text-[#0F172A] accent-[#0F172A] cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={`px-5 py-3.5 text-xs font-bold text-slate-600 uppercase tracking-wider ${
                    col.align === "center"
                      ? "text-center"
                      : col.align === "right"
                      ? "text-right"
                      : "text-left"
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 text-sm">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-6 py-10 text-center text-slate-400 font-medium"
                >
                  Tidak ada data ditemukan
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const id = keyExtractor(row, idx);
                const isSelected = currentSelected.includes(id);

                return (
                  <tr
                    key={id}
                    className={`transition-colors duration-100 hover:bg-slate-50/90 ${
                      isSelected ? "bg-slate-50/70" : "bg-white"
                    }`}
                  >
                    {selectable && (
                      <td className="px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(id)}
                          className="w-4 h-4 rounded text-[#0F172A] accent-[#0F172A] cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-5 py-3.5 text-slate-800 ${
                          col.align === "center"
                            ? "text-center"
                            : col.align === "right"
                            ? "text-right"
                            : "text-left"
                        }`}
                      >
                        {col.render
                          ? col.render(row, idx)
                          : row[col.key] ?? "-"}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer with Pagination matching Pagination Component */}
      <div className="bg-[#FAFBFD] border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-500 font-medium">
          Menampilkan <span className="font-semibold text-slate-800">1</span> sampai{" "}
          <span className="font-semibold text-slate-800">{Math.min(itemsPerPage, totalItems)}</span> dari{" "}
          <span className="font-semibold text-slate-800">{totalItems}</span> data
        </div>

        <div className="flex items-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      </div>
    </div>
  );
}

export default CustomTable;
