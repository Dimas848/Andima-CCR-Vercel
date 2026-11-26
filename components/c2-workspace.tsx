"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { RefreshCw, Search, X } from "lucide-react";
import Sidebar from "@/components/sidebar";
import { amount, money, number, type Evidence, type MonthlySummary, type SalesRecord } from "@/lib/c2-client";
import { formatPeriodLabel, formatTimestamp, useLang, type Lang } from "@/lib/c2-i18n";

export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#087ebd] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#07689c] disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
export const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-2 focus:outline-sky-600 disabled:bg-slate-100";

export function getRecordIssues(row: SalesRecord, lang: Lang = "id"): string[] {
  const isEn = lang === "en";
  const issues: string[] = [];
  const dpp = amount(row.sub_total);
  const vat = amount(row.vat_amount);
  const pph23 = amount(row.pph23_amount);
  const others = amount(row.others_cost);
  const iata = amount(row.dip_iata_cost);
  const total = amount(row.total_cost);

  if (dpp <= 0) issues.push(isEn ? "Tax base (DPP) is 0 or negative" : "DPP bernilai 0 atau negatif");
  if (iata > 0) issues.push(isEn ? "DIP IATA charge detected (should be 0 for Andima)" : "Terdapat tagihan DIP IATA (seharusnya 0 untuk Andima)");
  const expectedTotal = dpp + vat + pph23 + others + iata;
  if (Math.abs(total - expectedTotal) > 100) {
    issues.push(isEn ? "Total Cost does not match component sum" : "Total Biaya tidak sesuai penjumlahan komponen");
  }
  return issues;
}

export function countRecordsIssues(records: SalesRecord[]): number {
  return records.filter((r) => getRecordIssues(r).length > 0).length;
}

export function Workspace({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<boolean>;
      setSidebarCollapsed(Boolean(custom.detail));
    };
    window.addEventListener("andima-sidebar-collapse", handler);
    return () => window.removeEventListener("andima-sidebar-collapse", handler);
  }, []);

  return (
    <div className="min-h-screen bg-[#f3f6fa] text-slate-800">
      <Sidebar />
      <main
        className={`px-4 pb-10 pt-20 transition-[margin] duration-200 sm:px-8 ${
          sidebarCollapsed ? "lg:ml-0" : "lg:ml-[260px]"
        }`}
      >
        <div className="mx-auto max-w-[1560px]">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#102846]">{title}</h1>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">{description}</p>
            </div>
            {action}
          </header>
          <div className="space-y-6">{children}</div>
        </div>
      </main>
    </div>
  );
}

export function Card({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {title && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={`whitespace-pre-wrap rounded-lg border px-4 py-3 text-sm ${
        error ? "border-red-200 bg-red-50 text-red-800" : "border-sky-200 bg-sky-50 text-sky-900"
      }`}
    >
      {children}
    </div>
  );
}

export type SkeletonVariant =
  | "page"
  | "dashboard"
  | "table"
  | "table-inner"
  | "cards"
  | "evidence"
  | "validation"
  | "report";

function TableInnerSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="grid grid-cols-7 gap-4 bg-slate-50 px-4 py-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-3.5 rounded bg-slate-200" />
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-7 items-center gap-4 px-4 py-3.5">
            <div className="space-y-1.5">
              <div className="h-3 w-16 rounded bg-slate-200" />
              <div className="h-3.5 w-28 rounded bg-slate-100" />
            </div>
            {Array.from({ length: 6 }).map((__, colIdx) => (
              <div key={colIdx} className="ml-auto h-3.5 w-20 rounded bg-slate-100" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TableCardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="h-5 w-56 rounded bg-slate-200" />
        <div className="h-7 w-28 rounded-full bg-slate-100" />
      </div>
      <TableInnerSkeleton rows={rows} />
    </div>
  );
}

export function Skeleton({
  variant = "page",
  rows = 6,
}: {
  variant?: SkeletonVariant;
  rows?: number;
}) {
  const { isEn } = useLang();

  if (variant === "table-inner") {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={isEn ? "Loading data" : "Memuat data"}
        className="animate-[pulse_0.85s_ease-in-out_infinite]"
      >
        <TableInnerSkeleton rows={rows} />
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={isEn ? "Loading data" : "Memuat data"}
      className="space-y-6 animate-[pulse_0.85s_ease-in-out_infinite]"
    >
      {variant === "evidence" && (
        <>
          <div className="h-11 rounded-lg border border-sky-200 bg-sky-50/70" />
          <TableCardSkeleton rows={rows} />
        </>
      )}

      {variant === "validation" && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="h-5 w-48 rounded bg-slate-200" />
              <div className="h-6 w-32 rounded-full bg-slate-100" />
            </div>
            <div className="space-y-2.5">
              <div className="h-4 w-2/3 rounded bg-slate-200" />
              <div className="h-4 w-1/2 rounded bg-slate-100" />
              <div className="mt-3 h-9 w-44 rounded-lg bg-slate-200" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="rounded-xl border border-slate-200 border-t-4 border-t-sky-600/40 bg-white p-4 shadow-sm"
              >
                <div className="h-3 w-28 rounded bg-slate-200" />
                <div className="mt-3 h-7 w-36 rounded bg-slate-200" />
                <div className="mt-2 h-2.5 w-24 rounded bg-slate-100" />
              </div>
            ))}
          </div>
          <TableCardSkeleton rows={4} />
          <TableCardSkeleton rows={3} />
        </>
      )}

      {variant === "report" && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="h-5 w-44 rounded bg-slate-200" />
              <div className="h-6 w-32 rounded-full bg-slate-100" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-1/2 rounded bg-slate-200" />
              <div className="h-4 w-2/3 rounded bg-slate-100" />
            </div>
          </div>
          <TableCardSkeleton rows={4} />
          <TableCardSkeleton rows={5} />
          <TableCardSkeleton rows={3} />
          <TableCardSkeleton rows={3} />
        </>
      )}

      {(variant === "page" || variant === "dashboard" || variant === "cards") && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl border border-slate-200 border-t-4 border-t-sky-600/40 bg-white p-4 shadow-sm"
            >
              <div className="h-3 w-28 rounded bg-slate-200" />
              <div className="mt-3 h-7 w-36 rounded bg-slate-200" />
              <div className="mt-2 h-2.5 w-24 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      )}

      {(variant === "page" || variant === "dashboard" || variant === "table") && (
        <TableCardSkeleton rows={rows} />
      )}
    </div>
  );
}

export function LoadState({
  loading,
  error,
  onRetry,
  variant = "page",
  rows = 6,
}: {
  loading: boolean;
  error?: string;
  onRetry?: () => void;
  variant?: SkeletonVariant;
  rows?: number;
}) {
  const { isEn } = useLang();
  if (error) {
    return (
      <Notice error>
        {error}
        {onRetry && (
          <button type="button" className="ml-3 underline" onClick={onRetry}>
            {isEn ? "Retry" : "Coba lagi"}
          </button>
        )}
        {/sesi|login|authenticated/i.test(error) && (
          <Link className="ml-3 underline" href="/login">
            {isEn ? "Sign in" : "Masuk"}
          </Link>
        )}
      </Notice>
    );
  }
  return loading ? <Skeleton variant={variant} rows={rows} /> : null;
}

function SearchCombobox({
  label,
  value,
  allLabel,
  emptyLabel,
  options,
  onChange,
  className = "min-w-44 flex-1",
}: {
  label: string;
  value: string;
  allLabel: string;
  emptyLabel: string;
  options: { value: string; label: string; badge?: string }[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const { isEn } = useLang();
  const inputId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const keyword = searchText.trim().toLowerCase();
  const filtered = keyword
    ? options.filter(
        (item) =>
          item.label.toLowerCase().includes(keyword) ||
          (item.badge && item.badge.toLowerCase().includes(keyword))
      )
    : options;

  const isFiltered = Boolean(value && value !== "ALL");

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <label htmlFor={inputId} className="block text-xs font-semibold text-slate-600">
        {label}
      </label>
      <div className="relative mt-1.5 flex items-center">
        <Search size={15} className="pointer-events-none absolute left-3 text-slate-400" />
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          placeholder={isEn ? "Search" : "Cari"}
          value={open ? searchText : isFiltered ? value : ""}
          onFocus={() => {
            setSearchText(isFiltered ? value : "");
            setOpen(true);
          }}
          onChange={(event) => {
            setSearchText(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
            } else if (event.key === "Enter" && open && filtered.length > 0) {
              event.preventDefault();
              onChange(filtered[0].value);
              setOpen(false);
            }
          }}
          className={`${fieldClass} h-[42px] pl-9 ${isFiltered || (open && searchText) ? "pr-9" : ""}`}
        />
        {(isFiltered || (open && searchText)) && (
          <button
            type="button"
            aria-label={isEn ? `Reset ${label.toLowerCase()} filter` : `Reset filter ${label.toLowerCase()}`}
            onClick={() => {
              onChange("ALL");
              setSearchText("");
              setOpen(false);
            }}
            className="absolute right-2.5 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              onChange("ALL");
              setSearchText("");
              setOpen(false);
            }}
            className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-sm transition-colors hover:bg-sky-50 ${
              !isFiltered ? "bg-sky-50 font-semibold text-sky-700" : "text-slate-700"
            }`}
          >
            <span>{allLabel}</span>
            <span className="text-xs text-slate-400">{options.length}</span>
          </button>

          {filtered.map((item) => {
            const selected = value === item.value;
            return (
              <button
                type="button"
                key={item.value}
                onClick={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-sm transition-colors hover:bg-sky-50 ${
                  selected ? "bg-sky-50 font-semibold text-sky-700" : "text-slate-700"
                }`}
              >
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {filtered.length === 0 && (
            <p className="px-3.5 py-3 text-center text-xs text-slate-500">
              {isEn
                ? `${emptyLabel} "${searchText}" not found.`
                : `${emptyLabel} "${searchText}" tidak ditemukan.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function Filters({
  period,
  periods,
  onPeriod,
  company,
  companies,
  onCompany,
  dest,
  destinations,
  onDest,
  refresh,
  loading = false,
}: {
  period: string;
  periods: string[];
  onPeriod: (value: string) => void;
  company?: string;
  companies?: Pick<MonthlySummary, "company_name" | "customer_code">[];
  onCompany?: (value: string) => void;
  dest?: string;
  destinations?: string[];
  onDest?: (value: string) => void;
  refresh?: () => void;
  loading?: boolean;
}) {
  const { lang, isEn } = useLang();
  const options = [...new Set([period, ...periods].filter(Boolean))];
  const companyOptions = [...new Map((companies ?? []).map((row) => [row.company_name, row])).values()].map(
    (row) => ({
      value: row.company_name,
      label: row.company_name,
      badge: row.customer_code,
    })
  );
  const destOptions = [...new Set([...(dest && dest !== "ALL" ? [dest] : []), ...(destinations ?? [])])].map(
    (value) => ({
      value,
      label: value,
    })
  );

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <label className="min-w-44 flex-1 text-xs font-semibold text-slate-600">
        {isEn ? "Period" : "Periode"}
        <select
          className={`${fieldClass} mt-1.5 h-[42px]`}
          value={period}
          disabled={loading && !options.length}
          onChange={(event) => onPeriod(event.target.value)}
        >
          <option value="" disabled>
            {loading && !options.length
              ? isEn
                ? "Loading periods…"
                : "Memuat periode…"
              : isEn
              ? "Select period"
              : "Pilih periode"}
          </option>
          {options.map((value) => (
            <option key={value} value={value}>
              {formatPeriodLabel(value, lang)}
            </option>
          ))}
        </select>
      </label>

      {onCompany && (
        <SearchCombobox
          label={isEn ? "Company" : "Perusahaan"}
          value={company ?? "ALL"}
          allLabel={isEn ? "All companies" : "Semua perusahaan"}
          emptyLabel={isEn ? "Company" : "Perusahaan"}
          options={companyOptions}
          onChange={onCompany}
          className="min-w-44 flex-1"
        />
      )}

      {onDest && (
        <SearchCombobox
          label={isEn ? "City / Destination" : "Kota / destinasi"}
          value={dest ?? "ALL"}
          allLabel={isEn ? "All destinations" : "Semua destinasi"}
          emptyLabel={isEn ? "Destination" : "Destinasi"}
          options={destOptions}
          onChange={onDest}
          className="min-w-44 flex-1"
        />
      )}

      {refresh && (
        <button type="button" onClick={refresh} className={`${secondaryClass} h-[42px]`}>
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> {isEn ? "Refresh" : "Muat ulang"}
        </button>
      )}
    </div>
  );
}

// Grid KPI mendukung 8 Tile (4 kolom x 2 baris di layar lebar)
export function Kpis({ items }: { items: { label: string; value: ReactNode; detail?: string; alert?: boolean }[] }) {
  const gridCols = items.length === 8 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-5";
  return (
    <div className={`grid gap-3 ${gridCols}`}>
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-xl border border-slate-200 border-t-4 bg-white p-4 shadow-sm ${
            item.alert ? "border-t-amber-500" : "border-t-sky-600"
          }`}
        >
          <p className="text-xs font-medium text-slate-500">{item.label}</p>
          <p className={`mt-2 break-words text-xl font-bold ${item.alert ? "text-amber-700" : "text-slate-900"}`}>
            {item.value}
          </p>
          {item.detail && <p className="mt-1.5 text-xs text-slate-500">{item.detail}</p>}
        </div>
      ))}
    </div>
  );
}

export function Status({ validated }: { validated: boolean }) {
  const { isEn } = useLang();
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
        validated ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      {validated
        ? isEn
          ? "Validated / Locked"
          : "Disahkan / Terkunci"
        : isEn
        ? "Open"
        : "Terbuka"}
    </span>
  );
}

export type Column<T> = { label: string; cell: (row: T) => ReactNode; numeric?: boolean };
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  empty,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T, index: number) => string;
  empty?: string;
}) {
  const { isEn } = useLang();
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / 15));
  const active = Math.min(page, pages);
  const emptyText = empty ?? (isEn ? "No data available for this filter." : "Belum ada data untuk filter ini.");

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              {columns.map((column) => (
                <th
                  scope="col"
                  key={column.label}
                  className={`whitespace-nowrap px-4 py-3 font-semibold ${column.numeric ? "text-right" : "text-left"}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice((active - 1) * 15, active * 15).map((row, index) => (
              <tr key={rowKey(row, index)} className="hover:bg-sky-50/40">
                {columns.map((column) => (
                  <td
                    key={column.label}
                    className={`px-4 py-3 ${column.numeric ? "whitespace-nowrap text-right tabular-nums" : "text-left"}`}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={columns.length} className="py-10 text-center text-slate-500">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 15 && (
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            {isEn
              ? `${rows.length} rows · Page ${active} of ${pages}`
              : `${rows.length} baris · Halaman ${active} dari ${pages}`}
          </span>
          <div className="flex gap-2">
            <button type="button" className={secondaryClass} disabled={active === 1} onClick={() => setPage(active - 1)}>
              {isEn ? "Previous" : "Sebelumnya"}
            </button>
            <button
              type="button"
              className={secondaryClass}
              disabled={active === pages}
              onClick={() => setPage(active + 1)}
            >
              {isEn ? "Next" : "Berikutnya"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function SalesTable({ records }: { records: SalesRecord[] }) {
  const { lang, isEn } = useLang();
  const columns: Column<SalesRecord>[] = [
    { label: isEn ? "Period" : "Periode", cell: (row) => formatPeriodLabel(row.periode, lang) },
    { label: isEn ? "Job Number" : "Nomor Job", cell: (row) => row.job_number },
    { label: isEn ? "Company" : "Perusahaan", cell: (row) => row.company_name },
    { label: isEn ? "MAWB No." : "No. MAWB", cell: (row) => row.mawb_no },
    { label: "CW", cell: (row) => number(row.cw), numeric: true },
    { label: isEn ? "Destination" : "Tujuan", cell: (row) => row.dest },
    { label: isEn ? "Tax Base (Sub Total)" : "DPP (Dasar Pajak)", cell: (row) => money(row.sub_total), numeric: true },
    { label: isEn ? "VAT (11%)" : "PPN (VAT 11%)", cell: (row) => money(row.vat_amount), numeric: true },
    { label: isEn ? "WHT PPh 23 (2%)" : "PPh 23 (2%)", cell: (row) => money(row.pph23_amount), numeric: true },
    { label: isEn ? "Others" : "Lain-lain", cell: (row) => money(row.others_cost), numeric: true },
    { label: "DIP IATA", cell: (row) => money(row.dip_iata_cost), numeric: true },
    { label: isEn ? "Total Cost" : "Total Biaya", cell: (row) => <strong>{money(row.total_cost)}</strong>, numeric: true },
    {
      label: isEn ? "Issues" : "Kendala",
      cell: (row) => {
        const issues = getRecordIssues(row, lang);
        return issues.length === 0 ? (
          <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            {isEn ? "0 Issues" : "0 Kendala"}
          </span>
        ) : (
          <span
            title={issues.join(", ")}
            className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800"
          >
            {issues.length} {isEn ? "Issues" : "Kendala"} ({issues[0]})
          </span>
        );
      },
    },
  ];

  return (
    <DataTable
      rows={records}
      columns={columns}
      rowKey={(row, index) => row.record_id ?? `${row.job_number}-${index}`}
    />
  );
}

export function SummaryTable({ rows, detail }: { rows: MonthlySummary[]; detail?: (row: MonthlySummary) => void }) {
  const { isEn } = useLang();
  const columns: Column<MonthlySummary>[] = [
    {
      label: isEn ? "Company" : "Perusahaan",
      cell: (row) => (
        <>
          <span className="text-xs font-semibold text-sky-700">{row.customer_code}</span>
          <p className="min-w-52 font-medium">{row.company_name}</p>
        </>
      ),
    },
    { label: "Job", cell: (row) => number(row.total_jobs_count), numeric: true },
    { label: isEn ? "Tax Base (Sub Total)" : "DPP (Dasar Pajak)", cell: (row) => money(row.sum_sub_total), numeric: true },
    { label: isEn ? "VAT (11%)" : "PPN (VAT 11%)", cell: (row) => money(row.sum_vat), numeric: true },
    { label: isEn ? "WHT PPh 23 (2%)" : "PPh 23 (2%)", cell: (row) => money(row.sum_pph23), numeric: true },
    { label: isEn ? "Others" : "Lain-lain", cell: (row) => money(row.sum_others), numeric: true },
    { label: "DIP IATA", cell: (row) => money(row.sum_dip_iata), numeric: true },
    { label: isEn ? "Total Cost" : "Total Biaya", cell: (row) => <strong>{money(row.sum_total_cost)}</strong>, numeric: true },
    { label: isEn ? "Period Share" : "Porsi Periode", cell: (row) => `${number(row.company_share_pct)}%`, numeric: true },
  ];
  if (detail) {
    columns.push({
      label: isEn ? "Details" : "Rincian",
      cell: (row) => (
        <button type="button" className="font-semibold text-sky-700 underline" onClick={() => detail(row)}>
          {isEn ? "View details" : "Lihat rincian"}
        </button>
      ),
    });
  }
  return <DataTable rows={rows} columns={columns} rowKey={(row) => `${row.periode}-${row.customer_code}`} />;
}

export function HistoryTable({
  rows,
  onPreview,
  onDelete,
}: {
  rows: Evidence[];
  onPreview?: (row: Evidence) => void;
  onDelete?: (row: Evidence) => void;
}) {
  const { lang, isEn } = useLang();
  const columns: Column<Evidence>[] = [
    { label: isEn ? "Document" : "Dokumen", cell: (row) => <span className="break-all font-medium">{row.file_name}</span> },
    { label: isEn ? "Period" : "Periode", cell: (row) => formatPeriodLabel(row.period_month, lang) },
    {
      label: isEn ? "Upload Time" : "Waktu Unggah",
      cell: (row) => (
        <time dateTime={row.uploaded_at} title={row.uploaded_at}>
          {formatTimestamp(row.uploaded_at, lang)}
        </time>
      ),
    },
    {
      label: isEn ? "Uploaded By" : "Diunggah Oleh",
      cell: (row) => (
        <>
          {row.uploaded_by_name || (isEn ? "Not recorded" : "Belum tercatat")}
          <p className="text-xs text-slate-500">
            {row.uploaded_by_role || (isEn ? "Role not recorded" : "Peran belum tercatat")}
          </p>
        </>
      ),
    },
    { label: isEn ? "Rows" : "Baris", cell: (row) => number(row.total_rows), numeric: true },
    { label: isEn ? "Total Cost" : "Total Biaya", cell: (row) => money(row.total_cost_amount), numeric: true },
    { label: "Status", cell: (row) => row.status },
  ];
  if (onPreview || onDelete) {
    columns.push({
      label: isEn ? "Action" : "Tindakan",
      cell: (row) => (
        <div className="flex gap-3">
          {onPreview && (
            <button type="button" className="text-sky-700 underline" onClick={() => onPreview(row)}>
              {isEn ? "Preview" : "Pratinjau"}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              disabled={row.is_validated || row.status.toUpperCase() === "VALIDATED"}
              className="text-red-700 underline disabled:cursor-not-allowed disabled:text-slate-400"
              onClick={() => onDelete(row)}
            >
              {isEn ? "Delete" : "Hapus"}
            </button>
          )}
        </div>
      ),
    });
  }
  return <DataTable rows={rows} columns={columns} rowKey={(row) => row.upload_id} />;
}

export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const { isEn } = useLang();
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[90vh] w-[min(95vw,1400px)] overflow-y-auto rounded-xl bg-white p-6 text-slate-800 shadow-2xl backdrop:bg-slate-950/50"
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id={id} className="text-lg font-bold">
          {title}
        </h2>
        <button
          type="button"
          className={secondaryClass}
          onClick={onClose}
          disabled={busy}
          aria-label={isEn ? "Close" : "Tutup"}
        >
          <X size={18} />
        </button>
      </div>
      <div className="space-y-4">{children}</div>
    </dialog>
  );
}