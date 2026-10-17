"use client";

import { useCallback, useEffect, useState } from "react";

export type Numeric = number | string;
export interface MonthlySummary {
  customer_code: string; company_name: string; periode: string; total_jobs_count: number;
  sum_invoice_nominal: Numeric; sum_sub_total: Numeric; sum_vat: Numeric; sum_pph23: Numeric;
  sum_tax_cost: Numeric; sum_others: Numeric; sum_dip_iata: Numeric; sum_others_dip_iata: Numeric;
  sum_total_cost: Numeric; sum_profit: Numeric; company_share_pct: Numeric;
}
export interface SalesRecord {
  record_id?: string; upload_id?: string; customer_code?: string; periode: string;
  job_number: string; company_name: string; mawb_no: string; cw: Numeric; dest: string;
  invoice_nominal: Numeric; sub_total: Numeric; vat_amount: Numeric; pph23_amount: Numeric;
  others_cost: Numeric; dip_iata_cost: Numeric; total_cost: Numeric; profit_amount: Numeric;
}
export interface Evidence {
  upload_id: string; file_name: string; period_month: string; uploaded_at: string;
  uploaded_by_name: string | null; uploaded_by_role: string | null; total_rows: number;
  total_cost_amount: Numeric; status: string; file_size_bytes?: number; file_sha256?: string | null;
  is_validated?: boolean; source_total_cost_amount?: Numeric; reconciliation_difference?: Numeric;
}
export interface Validation {
  validation_id: string; periode: string; is_validated: boolean; validation_status: string;
  validated_by: string | null; validated_by_role: string | null; validated_at: string | null;
  validation_notes: string | null; total_cost: Numeric;
}
export interface UserInfo { id: string; name: string; role: string; canValidate: boolean; canDelete: boolean }
export interface Audit {
  log_id: string; periode: string; actor_name: string | null; actor_role: string | null;
  action_timestamp: string; action_type: string; validation_notes: string | null; total_cost_amount: Numeric;
}
export interface DashboardData {
  companies: MonthlySummary[];
  kpis: { total_customers: number; total_sub_total: Numeric; total_tax: Numeric; total_cost: Numeric; total_profit: Numeric };
  validation: Validation | null;
}
export interface CustomerData { companies: MonthlySummary[]; records: SalesRecord[] }
export interface TaxSummary {
  customer_code: string; company_name: string; job_count: number; total_sub_total: Numeric;
  total_vat_11: Numeric; total_pph_23: Numeric; total_others_only: Numeric;
  total_dip_iata: Numeric; total_others: Numeric; total_cost: Numeric;
}
export interface TaxData {
  companies: TaxSummary[]; records: SalesRecord[];
  totals: {sub_total: Numeric; vat_amount: Numeric; pph23_amount: Numeric; others_cost: Numeric; dip_iata_cost: Numeric; total_cost: Numeric};
}
export interface ValidationData { validation: Validation | null; companies: MonthlySummary[]; history: Evidence[]; totals: Record<string, Numeric> }
export interface ReportData { companies: MonthlySummary[]; records: SalesRecord[]; evidence: Evidence[]; validation: Validation; period: string; company: string }

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success !== true) {
    const message = body?.message || (response.status === 401 ? "Sesi berakhir. Silakan masuk kembali." : `Permintaan gagal (${response.status}).`);
    const details = Array.isArray(body?.errors) ? body.errors.map((item: unknown) => typeof item === "string" ? item : JSON.stringify(item)).join("\n") : "";
    throw new Error([message, details].filter(Boolean).join("\n"));
  }
  return body.data as T;
}

export function query(path: string, filters: Record<string, string>): string {
  return `${path}?${new URLSearchParams(filters).toString()}`;
}

/** Data is tied to its URL, so an old filter response can never replace the active one. */
export function useApi<T>(path: string | null) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{path: string | null; revision: number; data?: T; error?: string}>({path: null, revision: -1});
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    api<T>(path, {signal: controller.signal}).then(
      data => { if (!controller.signal.aborted) setResult({path, revision, data}); },
      error => { if (!controller.signal.aborted) setResult({path, revision, error: error instanceof Error ? error.message : "Data gagal dimuat."}); },
    );
    return () => controller.abort();
  }, [path, revision]);
  const current = result.path === path && result.revision === revision;
  return {data: current ? result.data : undefined, error: current ? result.error : undefined, loading: Boolean(path) && !current, reload: useCallback(() => setRevision(value => value + 1), [])};
}

export function usePeriod() {
  const periods = useApi<string[]>("/api/v1/cost-analytics/periods");
  const [selection, setSelection] = useState<string | null>(null);
  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get("period");
    if (selected) setSelection(selected);
  }, []);
  const period = selection ?? periods.data?.[0] ?? "";
  function setPeriod(value: string) {
    setSelection(value);
    const url = new URL(window.location.href);
    url.searchParams.set("period", value);
    window.history.replaceState(null, "", url);
  }
  return {period, setPeriod, periods: periods.data ?? [], loading: periods.loading, error: periods.error, reload: periods.reload};
}

export function useFilter(name: string) {
  const [value, setValue] = useState("ALL");
  useEffect(() => { setValue(new URLSearchParams(window.location.search).get(name) || "ALL"); }, [name]);
  return [value, (next: string) => {
    setValue(next);
    const url = new URL(window.location.href);
    if (next === "ALL") url.searchParams.delete(name); else url.searchParams.set(name, next);
    window.history.replaceState(null, "", url);
  }] as const;
}

export const amount = (value: Numeric | null | undefined) => Number(value ?? 0);
export const money = (value: Numeric | null | undefined) => value == null ? "—" : new Intl.NumberFormat("id-ID", {style: "currency", currency: "IDR", maximumFractionDigits: 2}).format(amount(value));
export const number = (value: Numeric | null | undefined) => value == null ? "—" : new Intl.NumberFormat("id-ID", {maximumFractionDigits: 2}).format(amount(value));
export const timestamp = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? `${new Intl.DateTimeFormat("id-ID", {dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Jakarta"}).format(new Date(value))} WIB` : "Belum tercatat";
