import { api, query, type CustomerData } from "./c2-client";

// Satu baris = satu perusahaan pada satu periode (kolom mengikuti vw_c2_company_monthly_summary, TR-1510-002)
export interface SummaryRow {
  customer_code: string;
  company_name: string;
  periode: string;
  total_jobs_count: number;
  sum_sub_total: number;
  sum_vat: number;
  sum_pph23: number;
  sum_tax_cost: number;
  sum_others_dip_iata: number;
  sum_total_cost: number;
  sum_profit: number;
}

export const num = (v: unknown) => { if (v == null || v === "" || !Number.isFinite(Number(v))) throw new Error("Nominal sumber tidak valid."); return Number(v); };

const MONTHS_ID = [
  "januari", "februari", "maret", "april", "mei", "juni",
  "juli", "agustus", "september", "oktober", "november", "desember",
];

// Mengubah "Oktober 2026" atau "2026-10" menjadi angka agar periode bisa diurutkan
export function periodKey(p: string): number {
  const iso = p.match(/^(\d{4})-(\d{2})/);
  if (iso) return Number(iso[1]) * 12 + Number(iso[2]);
  const [m, y] = p.trim().toLowerCase().split(/\s+/);
  const mi = MONTHS_ID.indexOf(m);
  const yr = parseInt(y, 10);
  return mi >= 0 && yr ? yr * 12 + mi + 1 : 0;
}

export function formatRupiah(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1_000_000_000)
    return `${sign}Rp ${(abs / 1_000_000_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} M`;
  if (abs >= 1_000_000)
    return `${sign}Rp ${(abs / 1_000_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} jt`;
  return `${sign}Rp ${abs.toLocaleString("id-ID")}`;
}

// Compatibility helper for local callers; identities come only from the v2 API.
export async function loadSummaryRows(period?: string): Promise<SummaryRow[]> {
  const periods = period ? [period] : await api<string[]>("/api/v1/cost-analytics/periods");
  const datasets = await Promise.all(periods.map(value => api<CustomerData>(query("/api/v1/cost-analytics/customers", {period: value}))));
  return datasets.flatMap(data => data.companies.map(row => ({
    customer_code: row.customer_code, company_name: row.company_name, periode: row.periode,
    total_jobs_count: num(row.total_jobs_count), sum_sub_total: num(row.sum_sub_total),
    sum_vat: num(row.sum_vat), sum_pph23: num(row.sum_pph23), sum_tax_cost: num(row.sum_tax_cost),
    sum_others_dip_iata: num(row.sum_others_dip_iata), sum_total_cost: num(row.sum_total_cost), sum_profit: num(row.sum_profit),
  })));
}