import { api, query, type CustomerData } from "./c2-client";
import { num } from "./cost-summary";

// Satu baris = satu job pada Company Sales Report (tabel c2_monthly_cost_records, TR-1510-001)
export interface CostRecord {
  id: string;
  periode: string;
  job_number: string;
  company_name: string;
  mawb_no: string;
  dest: string;
  sub_total: number;
  vat: number;
  pph23: number;
  others: number; // others_cost + dip_iata_cost (sama dengan "Others / DIP IATA" di Customer Cost)
  total_cost: number;
}

export async function loadCostRecords(period?: string): Promise<CostRecord[]> {
  const periods = period ? [period] : await api<string[]>("/api/v1/cost-analytics/periods");
  const datasets = await Promise.all(periods.map(value => api<CustomerData>(query("/api/v1/cost-analytics/customers", {period: value}))));
  return datasets.flatMap(data => data.records.map(row => {
    if (!row.record_id) throw new Error("Identitas rincian belum tersedia.");
    return { id: row.record_id, periode: row.periode, job_number: row.job_number, company_name: row.company_name,
      mawb_no: row.mawb_no, dest: row.dest, sub_total: num(row.sub_total), vat: num(row.vat_amount), pph23: num(row.pph23_amount),
      others: num(row.others_cost) + num(row.dip_iata_cost), total_cost: num(row.total_cost) };
  }));
}