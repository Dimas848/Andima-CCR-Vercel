"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { RefreshCw, X } from "lucide-react";
import Sidebar from "@/components/sidebar";
import { money, number, timestamp, type Evidence, type MonthlySummary, type SalesRecord } from "@/lib/c2-client";

export const buttonClass = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#087ebd] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#07689c] disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryClass = "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
export const fieldClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-2 focus:outline-sky-600 disabled:bg-slate-100";

export function Workspace({title, description, children, action}: {title: string; description: string; children: ReactNode; action?: ReactNode}) {
  return <div className="min-h-screen bg-[#f3f6fa] text-slate-800"><Sidebar /><main className="px-4 pb-10 pt-20 sm:px-8 lg:ml-[260px] lg:pt-9"><div className="mx-auto max-w-[1560px]"><header className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-sky-700">CCR / Monthly Cost · C2</p><h1 className="text-3xl font-bold tracking-tight text-[#102846]">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">{description}</p></div>{action}</header><div className="space-y-6">{children}</div></div></main></div>;
}

export function Card({title, children, action}: {title?: string; children: ReactNode; action?: ReactNode}) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">{title && <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold text-slate-900">{title}</h2>{action}</div>}{children}</section>;
}

export function Notice({children, error = false}: {children: ReactNode; error?: boolean}) {
  return <div role={error ? "alert" : "status"} className={`whitespace-pre-wrap rounded-lg border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-sky-200 bg-sky-50 text-sky-900"}`}>{children}</div>;
}

export function LoadState({loading, error, onRetry}: {loading: boolean; error?: string; onRetry?: () => void}) {
  if (error) return <Notice error>{error}{onRetry && <button type="button" className="ml-3 underline" onClick={onRetry}>Coba lagi</button>}{/sesi|login|authenticated/i.test(error) && <Link className="ml-3 underline" href="/login">Masuk</Link>}</Notice>;
  return loading ? <p role="status" className="animate-pulse py-5 text-sm text-slate-500">Memuat data…</p> : null;
}

export function Filters({period, periods, onPeriod, company, companies, onCompany, dest, destinations, onDest, refresh}: {period: string; periods: string[]; onPeriod: (value: string) => void; company?: string; companies?: Pick<MonthlySummary, "company_name" | "customer_code">[]; onCompany?: (value: string) => void; dest?: string; destinations?: string[]; onDest?: (value: string) => void; refresh?: () => void}) {
  const options = [...new Set([period, ...periods].filter(Boolean))];
  const companyOptions = [...new Map((companies ?? []).map(row => [row.company_name, row])).values()];
  return <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"><label className="min-w-44 flex-1 text-xs font-semibold text-slate-600">Periode<select className={`${fieldClass} mt-1.5`} value={period} onChange={event => onPeriod(event.target.value)}><option value="" disabled>Pilih periode</option>{options.map(value => <option key={value}>{value}</option>)}</select></label>{onCompany && <label className="min-w-60 flex-[2] text-xs font-semibold text-slate-600">Perusahaan<select className={`${fieldClass} mt-1.5`} value={company} onChange={event => onCompany(event.target.value)}><option value="ALL">Semua perusahaan</option>{company !== "ALL" && company && !companyOptions.some(row => row.company_name === company) && <option value={company}>{company}</option>}{companyOptions.map(row => <option key={row.customer_code} value={row.company_name}>{row.customer_code} · {row.company_name}</option>)}</select></label>}{onDest && <label className="min-w-44 flex-1 text-xs font-semibold text-slate-600">Kota / destinasi<select className={`${fieldClass} mt-1.5`} value={dest} onChange={event => onDest(event.target.value)}><option value="ALL">Semua destinasi</option>{[...new Set([...(dest && dest !== "ALL" ? [dest] : []), ...destinations ?? []])].map(value => <option key={value}>{value}</option>)}</select></label>}{refresh && <button type="button" onClick={refresh} className={secondaryClass}><RefreshCw size={15} /> Muat ulang</button>}</div>;
}

export function Kpis({items}: {items: {label: string; value: ReactNode; detail?: string}[]}) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{items.map(item => <div key={item.label} className="rounded-xl border border-slate-200 border-t-4 border-t-sky-600 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500">{item.label}</p><p className="mt-2 break-words text-xl font-bold text-slate-900">{item.value}</p>{item.detail && <p className="mt-2 text-xs text-slate-500">{item.detail}</p>}</div>)}</div>;
}

export function Status({validated}: {validated: boolean}) {
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${validated ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{validated ? "Selesai / Validated" : "Terbuka"}</span>;
}

export type Column<T> = {label: string; cell: (row: T) => ReactNode; numeric?: boolean};
export function DataTable<T>({rows, columns, rowKey, empty = "Belum ada data untuk filter ini."}: {rows: T[]; columns: Column<T>[]; rowKey: (row: T, index: number) => string; empty?: string}) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / 15));
  const active = Math.min(page, pages);
  return <><div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr>{columns.map(column => <th scope="col" key={column.label} className={`whitespace-nowrap px-4 py-3 font-semibold ${column.numeric ? "text-right" : "text-left"}`}>{column.label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.slice((active - 1) * 15, active * 15).map((row, index) => <tr key={rowKey(row, index)} className="hover:bg-sky-50/40">{columns.map(column => <td key={column.label} className={`px-4 py-3 ${column.numeric ? "whitespace-nowrap text-right tabular-nums" : "text-left"}`}>{column.cell(row)}</td>)}</tr>)}{!rows.length && <tr><td colSpan={columns.length} className="py-10 text-center text-slate-500">{empty}</td></tr>}</tbody></table></div>{rows.length > 15 && <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500"><span>{rows.length} baris · Halaman {active} dari {pages}</span><div className="flex gap-2"><button type="button" className={secondaryClass} disabled={active === 1} onClick={() => setPage(active - 1)}>Sebelumnya</button><button type="button" className={secondaryClass} disabled={active === pages} onClick={() => setPage(active + 1)}>Berikutnya</button></div></div>}</>;
}

export const salesColumns: Column<SalesRecord>[] = [
  {label: "Periode", cell: row => row.periode}, {label: "Job Number", cell: row => row.job_number},
  {label: "Company", cell: row => row.company_name}, {label: "MAWB No.", cell: row => row.mawb_no},
  {label: "CW", cell: row => number(row.cw), numeric: true}, {label: "DEST", cell: row => row.dest},
  {label: "Invoice Nominal", cell: row => money(row.invoice_nominal), numeric: true},
  {label: "Sub Total", cell: row => money(row.sub_total), numeric: true},
  {label: "VAT (PPN 11%)", cell: row => money(row.vat_amount), numeric: true},
  {label: "Cost PPh 23", cell: row => money(row.pph23_amount), numeric: true},
  {label: "Others", cell: row => money(row.others_cost), numeric: true},
  {label: "DIP IATA", cell: row => money(row.dip_iata_cost), numeric: true},
  {label: "Total Cost", cell: row => money(row.total_cost), numeric: true},
  {label: "Profit", cell: row => money(row.profit_amount), numeric: true},
];
export function SalesTable({records}: {records: SalesRecord[]}) {
  return <DataTable rows={records} columns={salesColumns} rowKey={(row, index) => row.record_id ?? `${row.job_number}-${index}`} />;
}
export function SummaryTable({rows, detail}: {rows: MonthlySummary[]; detail?: (row: MonthlySummary) => void}) {
  const columns: Column<MonthlySummary>[] = [
    {label: "Customer", cell: row => <><span className="text-xs font-semibold text-sky-700">{row.customer_code}</span><p className="min-w-52 font-medium">{row.company_name}</p></>},
    {label: "Job", cell: row => number(row.total_jobs_count), numeric: true},
    {label: "Invoice Nominal", cell: row => money(row.sum_invoice_nominal), numeric: true},
    {label: "Sub Total", cell: row => money(row.sum_sub_total), numeric: true},
    {label: "VAT", cell: row => money(row.sum_vat), numeric: true},
    {label: "PPh 23", cell: row => money(row.sum_pph23), numeric: true},
    {label: "Others", cell: row => money(row.sum_others), numeric: true},
    {label: "DIP IATA", cell: row => money(row.sum_dip_iata), numeric: true},
    {label: "Total Cost", cell: row => <strong>{money(row.sum_total_cost)}</strong>, numeric: true},
    {label: "Porsi periode", cell: row => `${number(row.company_share_pct)}%`, numeric: true},
    {label: "Profit", cell: row => money(row.sum_profit), numeric: true},
  ];
  if (detail) columns.push({label: "Rincian", cell: row => <button type="button" className="font-semibold text-sky-700 underline" onClick={() => detail(row)}>Lihat rincian</button>});
  return <DataTable rows={rows} columns={columns} rowKey={row => `${row.periode}-${row.customer_code}`} />;
}

export function HistoryTable({rows, onPreview, onDelete}: {rows: Evidence[]; onPreview?: (row: Evidence) => void; onDelete?: (row: Evidence) => void}) {
  const columns: Column<Evidence>[] = [
    {label: "Dokumen", cell: row => <span className="break-all font-medium">{row.file_name}</span>},
    {label: "Periode", cell: row => row.period_month},
    {label: "Waktu unggah", cell: row => <time dateTime={row.uploaded_at} title={row.uploaded_at}>{timestamp(row.uploaded_at)}</time>},
    {label: "Diunggah oleh", cell: row => <>{row.uploaded_by_name || "Belum tercatat"}<p className="text-xs text-slate-500">{row.uploaded_by_role || "Peran belum tercatat"}</p></>},
    {label: "Baris", cell: row => number(row.total_rows), numeric: true},
    {label: "Total Cost", cell: row => money(row.total_cost_amount), numeric: true},
    {label: "Status", cell: row => row.status},
  ];
  if (onPreview || onDelete) columns.push({label: "Tindakan", cell: row => <div className="flex gap-3">{onPreview && <button type="button" className="text-sky-700 underline" onClick={() => onPreview(row)}>Pratinjau</button>}{onDelete && <button type="button" disabled={row.is_validated || row.status.toUpperCase() === "VALIDATED"} className="text-red-700 underline disabled:cursor-not-allowed disabled:text-slate-400" onClick={() => onDelete(row)}>Hapus</button>}</div>});
  return <DataTable rows={rows} columns={columns} rowKey={row => row.upload_id} />;
}

export function Modal({title, children, onClose, busy = false}: {title: string; children: ReactNode; onClose: () => void; busy?: boolean}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog ref={dialog} aria-labelledby={id} onCancel={event => {event.preventDefault(); if (!busy) onClose();}} className="fixed inset-0 m-auto max-h-[90vh] w-[min(95vw,1400px)] overflow-y-auto rounded-xl bg-white p-6 text-slate-800 shadow-2xl backdrop:bg-slate-950/50"><div className="mb-5 flex items-center justify-between gap-4"><h2 id={id} className="text-lg font-bold">{title}</h2><button type="button" className={secondaryClass} onClick={onClose} disabled={busy} aria-label="Tutup"><X size={18} /></button></div><div className="space-y-4">{children}</div></dialog>;
}
