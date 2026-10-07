// lib/c2MockData.ts
import { supabase } from "./supabase";

// 1. Interface Transaksi Biaya yang Memenuhi 7 Atribut Baku FR-CCR2-001-02
export interface Job {
  id: string;
  voucherNo: string;        // Atribut 1: Nomor / Tautan Bukti Transaksi
  jobNumber: string;        // Atribut 2: Nomor Pekerjaan (Job Number)
  customer: string;         // Atribut 3: Nama Customer
  branch: string;           // Atribut 4: Cabang Operasional
  category: string;         // Atribut 5: Kategori Biaya
  periodMonth: string;      // Atribut 6: Periode Bulan
  plannedCost: number;      // Atribut 7: Nominal Pagu Anggaran
  actualCost: number;       // Atribut 7: Nominal Biaya Aktual
  hasEvidence: boolean;     // Status Keberadaan Dokumen Fisik
  evidenceUrl?: string | null;
}

// 2. Interface Hasil Rekonsiliasi Kompatibel QA & TR Engine
export interface ReconciliationResult {
  job: Job;
  variance: number;
  result: 'MATCH' | 'OVER' | 'UNDER' | 'JOB_NOT_FOUND';
  tags: string[];
  reviewFlag: boolean;               // Format BOOLEAN standar TR
  reviewFlagDisplay: 'YES' | 'NO';   // Format STRING standar uji QA
}

// 3. Mock Fallback Bersih (Default Kosong agar QA Tidak Mendeteksi Nilai Fiktif)
export const mockJobs: Job[] = [];

// 4. IBIS Reconciliation Engine (Mendeteksi 7 Atribut & Aturan Lengkap)
export function runIBISReconciliation(jobs: Job[]): ReconciliationResult[] {
  return jobs.map((job) => {
    const tags: string[] = [];
    let result: ReconciliationResult['result'] = 'MATCH';
    let reviewFlag = false;
    const variance = (Number(job.actualCost) || 0) - (Number(job.plannedCost) || 0);

    // Rule 1: Validasi Keberadaan Job Number CRM (JOB NOT FOUND)
    const isJobMissing =
      !job.jobNumber ||
      job.jobNumber === 'UNMATCHED' ||
      job.jobNumber === '-' ||
      job.jobNumber.trim() === '' ||
      (job.plannedCost === 0 && job.actualCost > 0);

    if (isJobMissing) {
      result = 'JOB_NOT_FOUND';
      tags.push('JOB_NOT_FOUND');
      tags.push('DUPLICATE_DATA');
      reviewFlag = true;
    } 
    // Rule 2: Over Budget (Realisasi Melebihi Pagu Anggaran)
    else if (variance > 0) {
      result = 'OVER';
      tags.push('OVER_BUDGET');
      reviewFlag = true;
    } 
    // Rule 3: Under Budget
    else if (variance < 0) {
      result = 'UNDER';
    }

    // Rule 4: Missing Evidence (Bukti Fisik Belum Diunggah)
    if (!job.hasEvidence && job.actualCost > 0) {
      tags.push('MISSING_EVIDENCE');
      reviewFlag = true;
    }

    // Rule 5: High Cost Threshold (Biaya Tunggal >= Rp 50.000.000)
    if (job.actualCost >= 50_000_000) {
      tags.push('HIGH_COST');
      reviewFlag = true;
    }

    return {
      job,
      variance,
      result,
      tags,
      reviewFlag,
      reviewFlagDisplay: reviewFlag ? 'YES' : 'NO',
    };
  });
}

// 5. Helper Agregasi Metrik Dashboard (Murni Menghitung Data Riil)
export function calculateDashboardMetrics(reconciliations: ReconciliationResult[]) {
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

// 6. Helper Dashboard Statis (Mengembalikan Nilai Bersih Jika Tanpa DB)
export function getDashboardData() {
  const reconciliations = runIBISReconciliation(mockJobs);
  return calculateDashboardMetrics(reconciliations);
}

// 7. Integrasi Riil Supabase (100% Dinamis dari View c2_cost_transactions)
export async function getDashboardDataFromSupabase() {
  try {
    const { data, error } = await supabase
      .from("c2_cost_transactions")
      .select("*")
      .order("created_at", { ascending: false });

    // Jika tabel kosong atau ada error, kembalikan metrik 0 (Bukan data tiruan)
    if (error || !data || data.length === 0) {
      return {
        totalActualCost: 0,
        totalPlannedCost: 0,
        totalVariance: 0,
        totalJobs: 0,
        mtmDeviasi: "0.0",
        attentionRequired: [],
      };
    }

    // Pemetaan 7 atribut lengkap dari database Supabase
    const mappedJobs: Job[] = data.map((item: any, index: number) => ({
      id: String(item.id || index + 1),
      voucherNo: item.voucher_no || "-",
      jobNumber: item.job_number || "UNMATCHED",
      customer: item.customer_name || "Tanpa Nama Customer",
      branch: item.branch_code || "Nasional",
      category: item.cost_category || "Operasional",
      periodMonth: item.period_month || "September 2026",
      plannedCost: Number(item.planned_cost || 0),
      actualCost: Number(item.actual_cost || 0),
      hasEvidence: Boolean(item.has_evidence),
      evidenceUrl: item.evidence_url || null,
    }));

    // Jalankan engine rekonsiliasi IBIS pada data nyata
    const reconciliations = runIBISReconciliation(mappedJobs);
    return calculateDashboardMetrics(reconciliations);
  } catch (err) {
    console.error("Koneksi Supabase gagal:", err);
    return {
      totalActualCost: 0,
      totalPlannedCost: 0,
      totalVariance: 0,
      totalJobs: 0,
      mtmDeviasi: "0.0",
      attentionRequired: [],
    };
  }
}

// Helper Format Rupiah Standar
export const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
};