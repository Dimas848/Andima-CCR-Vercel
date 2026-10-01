// lib/c2MockData.ts
import { supabase } from "./supabase";

export interface Job {
  id: string;
  jobNumber: string;
  customer: string;
  plannedCost: number;
  actualCost: number;
  hasEvidence: boolean;
  category?: string;
  branch?: string;
}

export interface ReconciliationResult {
  job: Job;
  variance: number;
  result: 'MATCH' | 'OVER' | 'UNDER' | 'JOB_NOT_FOUND';
  tags: string[];
  reviewFlag: boolean;
}

// 1. Data Mock Fallback (Data Riil PT Andima jika DB offline)
export const mockJobs: Job[] = [
  { id: '1', jobNumber: 'AENAT/2609/0354', customer: 'PT ATLANTIC CONTAINER LINI', plannedCost: 855342, actualCost: 855342, hasEvidence: true, category: 'HANDLING', branch: 'Jakarta Pusat' },
  { id: '2', jobNumber: 'BI/2608/3801', customer: 'PT CEVA AIR OCEAN INDONESIA', plannedCost: 77050, actualCost: 95000, hasEvidence: false, category: 'TRUCKING', branch: 'Surabaya' },
  { id: '3', jobNumber: 'DSVEXP/2608/4808', customer: 'PT DSV TRANSPORT INDONESIA', plannedCost: 471400, actualCost: 471400, hasEvidence: true, category: 'TRUCKING', branch: 'Jakarta Pusat' },
  { id: '4', jobNumber: 'HDL-EXP/2608/906B', customer: 'PT MAERSK LOGISTICS INDONESIA', plannedCost: 277317, actualCost: 200000, hasEvidence: true, category: 'STORAGE', branch: 'Semarang' },
  { id: '5', jobNumber: 'DSVIMP/2608/2818', customer: 'PT DSV TRANSPORT INDONESIA', plannedCost: 50000, actualCost: 180930, hasEvidence: true, category: 'HANDLING', branch: 'Jakarta Pusat' },
  { id: '6', jobNumber: 'JOB-UNKNOWN-001', customer: 'PT CEVA AIR OCEAN INDONESIA', plannedCost: 0, actualCost: 500000, hasEvidence: false, category: 'OTHER_OPERATIONAL', branch: 'Jakarta Pusat' },
];

// 2. IBIS Reconciliation Engine
export function runIBISReconciliation(jobs: Job[]): ReconciliationResult[] {
  return jobs.map((job) => {
    const tags: string[] = [];
    let result: ReconciliationResult['result'] = 'MATCH';
    let reviewFlag = false;
    const variance = job.actualCost - job.plannedCost;

    // Aturan IBIS: JOB NOT FOUND
    if (job.plannedCost === 0 && job.actualCost > 0) {
      result = 'JOB_NOT_FOUND';
      tags.push('JOB_NOT_FOUND');
      reviewFlag = true;
    } 
    // Aturan IBIS: OVER BUDGET
    else if (variance > 0) {
      result = 'OVER';
      tags.push('OVER_BUDGET');
      reviewFlag = true;
    } 
    // Aturan IBIS: UNDER
    else if (variance < 0) {
      result = 'UNDER';
    }

    // Aturan IBIS: MISSING EVIDENCE
    if (!job.hasEvidence && job.actualCost > 0) {
      tags.push('MISSING_EVIDENCE');
      reviewFlag = true;
    }

    return { job, variance, result, tags, reviewFlag };
  });
}

// 3. Helper Dashboard Statis
export function getDashboardData() {
  const reconciliations = runIBISReconciliation(mockJobs);
  
  const totalActualCost = reconciliations.reduce((sum, r) => sum + r.job.actualCost, 0);
  const totalPlannedCost = reconciliations.reduce((sum, r) => sum + r.job.plannedCost, 0);
  const totalVariance = totalActualCost - totalPlannedCost;
  const totalJobs = reconciliations.length;
  const attentionRequired = reconciliations.filter((r) => r.reviewFlag);
  const mtmDeviasi = totalPlannedCost > 0 ? ((totalVariance / totalPlannedCost) * 100).toFixed(1) : '0.0';

  return {
    totalActualCost,
    totalPlannedCost,
    totalVariance,
    totalJobs,
    mtmDeviasi,
    attentionRequired,
  };
}

// 4. Integrasi Riil Supabase (Tabel c2_cost_transactions)
export async function getDashboardDataFromSupabase() {
  try {
    const { data, error } = await supabase
      .from("c2_cost_transactions")
      .select("*");

    if (error || !data || data.length === 0) {
      console.warn("Supabase kosong atau gagal baca data, beralih ke mock fallback:", error?.message);
      return getDashboardData();
    }

    // Pemetaan data dari kolom c2_cost_transactions
    const mappedJobs: Job[] = data.map((item: any, index: number) => ({
      id: String(item.id || index + 1),
      jobNumber: item.job_number || "UNMATCHED",
      customer: item.customer_name || "PT Unknown Customer",
      plannedCost: Number(item.planned_cost || 0),
      actualCost: Number(item.actual_cost || 0),
      hasEvidence: Boolean(item.has_evidence),
      category: item.cost_category,
      branch: item.branch_code,
    }));

    // Jalankan engine rekonsiliasi IBIS
    const reconciliations = runIBISReconciliation(mappedJobs);

    const totalActualCost = reconciliations.reduce((sum, r) => sum + r.job.actualCost, 0);
    const totalPlannedCost = reconciliations.reduce((sum, r) => sum + r.job.plannedCost, 0);
    const totalVariance = totalActualCost - totalPlannedCost;
    const totalJobs = reconciliations.length;
    const attentionRequired = reconciliations.filter((r) => r.reviewFlag);
    const mtmDeviasi = totalPlannedCost > 0 ? ((totalVariance / totalPlannedCost) * 100).toFixed(1) : '0.0';

    return {
      totalActualCost,
      totalPlannedCost,
      totalVariance,
      totalJobs,
      mtmDeviasi,
      attentionRequired,
    };
  } catch (err) {
    console.error("Koneksi Supabase gagal, fallback:", err);
    return getDashboardData();
  }
}

// Format Rupiah
export const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
};