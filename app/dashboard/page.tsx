"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import ExcelJS from "exceljs";
import {
  Download,
  Bell,
  CalendarDays,
  SlidersHorizontal,
  CreditCard,
  Landmark,
  TrendingUp,
  Users,
  CheckCircle2,
  Loader2,
  X,
  RefreshCw,
  AlertCircle,
  FileText,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

import Sidebar from "@/components/sidebar";
import BudgetChart from "./BudgetChart";
import CustomerBreakdown from "./CustomerBreakdown";
import ExceptionSummary from "./ExceptionSummary";
import DataHealth from "./DataHealth";
import CustomDropdown, { DropdownOption } from "./CustomDropdown";
import { supabase } from "@/lib/supabase";

// Interface Transaksi Biaya C2 Resmi Sesuai View c2_cost_transactions
export interface CostTransaction {
  id: string;
  job_number: string;
  customer_name: string;
  branch_code: string;
  cost_category: string;
  period_month: string;
  planned_cost: number;
  actual_cost: number;
  variance: number;
  has_evidence: boolean;
  evidence_url: string | null;
  reconciliation_result: string;
  review_flag: boolean;
  exception_tags: string[];
  voucher_no: string;
  description: string;
  is_job_matched: boolean;
  consignee?: string;
  shipper?: string;
  created_at?: string;
}

// Helper Nama Bulan Real-Time Bahasa Indonesia
const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

function getDynamicPeriod(offsetMonths = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() - offsetMonths);
  return `${MONTH_NAMES_ID[d.getMonth()]} ${d.getFullYear()}`;
}

// Helper Format Rupiah Compact & Standar
const formatCompactRupiah = (val: number) => {
  if (val === 0) return "Rp 0";
  if (Math.abs(val) >= 1_000_000_000) {
    return `Rp ${(val / 1_000_000_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} M`;
  }
  if (Math.abs(val) >= 1_000_000) {
    return `Rp ${(val / 1_000_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} jt`;
  }
  return `Rp ${val.toLocaleString("id-ID")}`;
};

// Helper Parser JSON Array untuk exception_tags dari Supabase
const parseTags = (raw: any): string[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

// =========================================================================
// SUB-KOMPONEN: SKELETON LOADERS
// =========================================================================
function KpiSkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
      <div className="flex items-start justify-between">
        <div className="h-3 w-20 rounded bg-slate-200" />
        <div className="h-7 w-7 rounded-lg bg-slate-100" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-7 w-28 rounded bg-slate-200" />
        <div className="h-4 w-12 rounded bg-slate-100" />
      </div>
      <div className="mt-3 h-3 w-36 rounded bg-slate-100" />
    </div>
  );
}

function SectionSkeletonCard({ height = "h-72" }: { height?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse ${height}`}>
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="space-y-1.5">
          <div className="h-4 w-44 rounded bg-slate-200" />
          <div className="h-3 w-56 rounded bg-slate-100" />
        </div>
        <div className="h-6 w-16 rounded bg-slate-100" />
      </div>
      <div className="mt-6 flex h-4/5 items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-slate-300">
          <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
          <span className="text-xs font-medium text-slate-400">Sinkronisasi data Supabase...</span>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// SUB-KOMPONEN: NOTIFICATION POPOVER (SINKRON DENGAN PRIORITY EXCEPTION)
// =========================================================================
interface NotificationPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  transactions?: CostTransaction[];
  periode?: string;
  onViewAllExceptions?: () => void;
}

function NotificationPopover({
  isOpen,
  onClose,
  transactions = [],
  periode,
  onViewAllExceptions,
}: NotificationPopoverProps) {
  const [activeTab, setActiveTab] = useState<"semua" | "belum_dibaca">("semua");
  const [isMarkedAllRead, setIsMarkedAllRead] = useState(false);

  // Kalkulasi Murni dari Database (Sinkron dengan Kategori Anomali)
  const notifData = useMemo(() => {
    let overBudget = 0;
    let overBudgetSum = 0;
    let highCost = 0;
    let highCostSum = 0;
    let missingEvidence = 0;
    let missingEvidenceSum = 0;
    let unmatched = 0;
    let unmatchedSum = 0;

    transactions.forEach((t) => {
      const actual = Number(t.actual_cost) || 0;
      const planned = Number(t.planned_cost) || 0;
      const variance = Number(t.variance) || (actual - planned);

      if (variance > 0 || t.exception_tags?.includes("OVER_BUDGET")) {
        overBudget++;
        overBudgetSum += actual;
      }
      if (actual >= 50_000_000 || t.exception_tags?.includes("HIGH_COST")) {
        highCost++;
        highCostSum += actual;
      }
      if (!t.has_evidence || t.exception_tags?.includes("MISSING_EVIDENCE")) {
        missingEvidence++;
        missingEvidenceSum += actual;
      }
      if (!t.is_job_matched || t.job_number === "UNMATCHED" || t.exception_tags?.includes("JOB_NOT_FOUND") || t.exception_tags?.includes("DUPLICATE_DATA")) {
        unmatched++;
        unmatchedSum += actual;
      }
    });

    const total = transactions.filter(
      (t) => t.review_flag || t.variance > 0 || !t.has_evidence || !t.is_job_matched
    ).length;

    return {
      totalExceptions: total,
      overBudgetCount: overBudget,
      overBudgetValue: formatCompactRupiah(overBudgetSum),
      highCostCount: highCost,
      highCostValue: formatCompactRupiah(highCostSum),
      missingEvidenceCount: missingEvidence,
      missingEvidenceValue: formatCompactRupiah(missingEvidenceSum),
      unmatchedCount: unmatched,
      unmatchedValue: formatCompactRupiah(unmatchedSum),
    };
  }, [transactions]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/5" onClick={onClose} />

      <div className="absolute right-0 top-11 z-50 w-[380px] rounded-2xl border border-slate-200/90 bg-white shadow-2xl animate-in fade-in slide-in-from-top-2">
        <div className="p-5 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Notifikasi</h2>
              <span className="h-2 w-2 rounded-full bg-[#0a7ebf]" />
            </div>

            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-2 text-xs font-bold text-slate-800">
            {notifData.totalExceptions} exception perlu tindak lanjut
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Ringkasan exception · {periode}
          </p>

          <button
            onClick={() => setIsMarkedAllRead(true)}
            className="mt-3 text-xs font-semibold text-[#0a7ebf] transition hover:underline"
          >
            Tandai semua dibaca
          </button>

          <div className="mt-3 flex items-center gap-5 border-b border-slate-100">
            <button
              onClick={() => setActiveTab("semua")}
              className={`pb-2 text-xs font-bold transition ${
                activeTab === "semua"
                  ? "border-b-2 border-[#0a7ebf] text-[#0a7ebf]"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setActiveTab("belum_dibaca")}
              className={`pb-2 text-xs font-medium transition ${
                activeTab === "belum_dibaca"
                  ? "border-b-2 border-[#0a7ebf] text-[#0a7ebf] font-bold"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Belum dibaca
            </button>
          </div>
        </div>

        <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 text-left">
          {activeTab === "belum_dibaca" && isMarkedAllRead ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Semua notifikasi telah ditandai dibaca.
            </div>
          ) : notifData.totalExceptions === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Tidak ada anomali atau exception yang memerlukan peninjauan.
            </div>
          ) : (
            <>
              {/* Item 1: Over Budget */}
              <div className="flex gap-3.5 p-5 transition hover:bg-slate-50/60">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-[#e11d48]">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900">Over Budget</h3>
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                      {notifData.overBudgetCount} item
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {notifData.overBudgetValue}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    Realisasi biaya melebihi budget. Tinjau penyebab selisih dan kesesuaian anggaran.
                  </p>
                  <span className="mt-2 block text-[11px] font-bold text-[#e11d48]">
                    Prioritas review anggaran
                  </span>
                </div>
              </div>

              {/* Item 2: High Cost */}
              <div className="flex gap-3.5 p-5 transition hover:bg-slate-50/60">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-[#e11d48]">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900">High Cost</h3>
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                      {notifData.highCostCount} item
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {notifData.highCostValue}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    Biaya tunggal di atas threshold rule. Periksa kewajaran nominal dan detail transaksi.
                  </p>
                  <span className="mt-2 block text-[11px] font-bold text-[#e11d48]">
                    Perlu peninjauan biaya
                  </span>
                </div>
              </div>

              {/* Item 3: Missing Evidence */}
              <div className="flex gap-3.5 p-5 transition hover:bg-slate-50/60">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900">Missing Evidence</h3>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      {notifData.missingEvidenceCount} item
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {notifData.missingEvidenceValue}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    Dokumen bukti belum lengkap. Lengkapi kuitansi yang valid untuk verifikasi biaya.
                  </p>
                  <span className="mt-2 block text-[11px] font-bold text-amber-600">
                    Perlu kelengkapan dokumen
                  </span>
                </div>
              </div>

              {/* Item 4: Unmatched CRM */}
              {notifData.unmatchedCount > 0 && (
                <div className="flex gap-3.5 p-5 transition hover:bg-slate-50/60">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-900">Unmatched CRM</h3>
                      <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                        {notifData.unmatchedCount} item
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {notifData.unmatchedValue}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      Nomor pekerjaan tidak ditemukan di master database CRM.
                    </p>
                    <span className="mt-2 block text-[11px] font-bold text-purple-600">
                      Verifikasi Job Number
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="rounded-b-2xl bg-[#edf8fd] p-3 text-center border-t border-sky-100/60">
          <button
            onClick={() => {
              onClose();
              if (onViewAllExceptions) onViewAllExceptions();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0a7ebf] transition hover:text-[#08689d]"
          >
            <span>Lihat semua exception</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}

// =========================================================================
// KOMPONEN UTAMA DASHBOARD
// =========================================================================
export default function DashboardPage() {
  const router = useRouter();

  const currentLivePeriod = useMemo(() => getDynamicPeriod(0), []);

  const [allTransactions, setAllTransactions] = useState<CostTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<CostTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // Filter States: Diselaraskan dengan 7 Atribut FR-001 (Periode Bulan, Customer, Cabang Operasional)
  const [periode, setPeriode] = useState<string>("ALL");
  const [customer, setCustomer] = useState<string>("ALL");
  const [cabang, setCabang] = useState<string>("ALL");
  const [isFiltering, setIsFiltering] = useState(false);

  // State Ekspor
  const [exportState, setExportState] = useState<"idle" | "queueing" | "ready">("idle");
  const [exportJobId, setExportJobId] = useState<string | null>(null);

  const dynamicPeriodeOptions: DropdownOption[] = useMemo(() => [
    { value: "ALL", label: "Semua Periode" },
    { value: getDynamicPeriod(0), label: getDynamicPeriod(0) },
    { value: getDynamicPeriod(1), label: getDynamicPeriod(1) },
    { value: getDynamicPeriod(2), label: getDynamicPeriod(2) },
    { value: getDynamicPeriod(3), label: getDynamicPeriod(3) },
  ], []);

  // 1. Tarik Data Murni dari Supabase View c2_cost_transactions
  const fetchSupabaseData = useCallback(async () => {
    try {
      setIsSyncing(true);
      const { data, error } = await supabase
        .from("c2_cost_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Gagal mengambil data dari Supabase:", error.message);
        setAllTransactions([]);
        setFilteredTransactions([]);
      } else if (data) {
        const formatted: CostTransaction[] = data.map((item) => ({
          id: item.id,
          job_number: item.job_number || "-",
          customer_name: item.customer_name || "Unknown Customer",
          branch_code: item.branch_code || "Nasional",
          cost_category: item.cost_category || "TRUCKING",
          period_month: item.period_month || currentLivePeriod,
          planned_cost: Number(item.planned_cost || 0),
          actual_cost: Number(item.actual_cost || 0),
          variance: Number(item.variance || 0),
          has_evidence: Boolean(item.has_evidence),
          evidence_url: item.evidence_url || null,
          reconciliation_result: item.reconciliation_result || "MATCH",
          review_flag: Boolean(item.review_flag),
          exception_tags: parseTags(item.exception_tags),
          voucher_no: item.voucher_no || "-",
          description: item.description || "",
          is_job_matched: Boolean(item.is_job_matched),
          consignee: item.consignee,
          shipper: item.shipper,
          created_at: item.created_at,
        }));

        setAllTransactions(formatted);
        setFilteredTransactions(formatted);
      }
    } catch (err) {
      console.error("Koneksi Supabase error:", err);
      setAllTransactions([]);
      setFilteredTransactions([]);
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, [currentLivePeriod]);

  useEffect(() => {
    fetchSupabaseData();
  }, [fetchSupabaseData]);

  // 2. Dropdown Customer Dinamis (Menggantikan istilah Entitas sesuai QA)
  const dynamicCustomerOptions: DropdownOption[] = useMemo(() => {
    const unique = Array.from(new Set(allTransactions.map((t) => t.customer_name))).filter(Boolean);
    const options: DropdownOption[] = [{ value: "ALL", label: "Semua Customer" }];
    unique.forEach((c) => options.push({ value: c, label: c }));
    return options;
  }, [allTransactions]);

  // 3. Dropdown Cabang Operasional Dinamis (Menggantikan istilah Region sesuai QA)
  const dynamicCabangOptions: DropdownOption[] = useMemo(() => {
    const unique = Array.from(new Set(allTransactions.map((t) => t.branch_code))).filter(Boolean);
    const options: DropdownOption[] = [{ value: "ALL", label: "Semua Cabang" }];
    unique.forEach((r) => options.push({ value: r, label: r }));
    return options;
  }, [allTransactions]);

  // 4. Handler Terapkan Filter
  const handleApplyFilter = () => {
    setIsFiltering(true);
    setTimeout(() => {
      let filtered = [...allTransactions];
      if (periode !== "ALL") {
        filtered = filtered.filter((t) => t.period_month === periode);
      }
      if (customer !== "ALL") {
        filtered = filtered.filter((t) => t.customer_name === customer);
      }
      if (cabang !== "ALL") {
        filtered = filtered.filter((t) => t.branch_code === cabang);
      }
      setFilteredTransactions(filtered);
      setIsFiltering(false);
    }, 250);
  };

  // 5. Kalkulasi KPI Murni (Sinkron 100% dengan Priority Exception)
  const kpiData = useMemo(() => {
    const totalActual = filteredTransactions.reduce((acc, curr) => acc + (Number(curr.actual_cost) || 0), 0);
    const totalPlanned = filteredTransactions.reduce((acc, curr) => acc + (Number(curr.planned_cost) || 0), 0);
    const totalVariance = totalActual - totalPlanned;
    
    const variancePercentVal = totalPlanned > 0 ? ((totalVariance / totalPlanned) * 100).toFixed(1) : "0.0";
    const realisasiPercentVal = totalPlanned > 0 ? ((totalActual / totalPlanned) * 100).toFixed(1) : "0.0";

    const verifiedCount = filteredTransactions.filter((t) => t.has_evidence).length;
    const totalCustomerCount = new Set(filteredTransactions.map((t) => t.customer_name).filter(Boolean)).size;

    // Perhitungan anomali memasukkan is_job_matched agar identik dengan Priority Exception
    const attentionTransactions = filteredTransactions.filter(
      (t) => t.review_flag || t.variance > 0 || !t.has_evidence || !t.is_job_matched
    );
    const attentionCustomerCount = new Set(attentionTransactions.map((t) => t.customer_name).filter(Boolean)).size;

    return {
      totalActualDisplay: formatCompactRupiah(totalActual),
      totalPlannedDisplay: formatCompactRupiah(totalPlanned),
      totalVarianceDisplay: totalVariance >= 0 ? `+${formatCompactRupiah(totalVariance)}` : formatCompactRupiah(totalVariance),
      variancePercent: Number(variancePercentVal) >= 0 ? `+${variancePercentVal}%` : `${variancePercentVal}%`,
      varianceCardPercent: Number(variancePercentVal) >= 0 ? `+${variancePercentVal}%` : `${variancePercentVal}%`,
      realisasiPercent: `${realisasiPercentVal}%`,
      verifiedCountText: `${verifiedCount.toLocaleString("id-ID")} transaksi terverifikasi`,
      totalCustomer: `${totalCustomerCount}`,
      attentionCustomerText: `${attentionCustomerCount} customer perlu perhatian`,
    };
  }, [filteredTransactions]);

  // Ekspor Excel Asinkron
  const handleAsyncExport = () => {
    setExportState("queueing");
    const simulatedJobId = `EXP-${Date.now().toString().slice(-6)}`;
    setExportJobId(simulatedJobId);
    setTimeout(() => {
      setExportState("ready");
    }, 600);
  };

  const handleDownloadExcelFiles = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "PT Andima Transportindo - CCR C2";
      const sheet = workbook.addWorksheet("Monthly Cost Summary");
      sheet.addRow(["Indikator", "Nilai"]);
      sheet.addRow(["Total Cost", kpiData.totalActualDisplay]);
      sheet.addRow(["Budget", kpiData.totalPlannedDisplay]);
      sheet.addRow(["Variance", kpiData.totalVarianceDisplay]);
      sheet.addRow(["Total Customer", kpiData.totalCustomer]);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `CCR_Dashboard_Report_${periode.replace(/\s+/g, "_")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setExportState("idle");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#f4f7fc]">
      {/* Sidebar Navigasi */}
      <Sidebar />

      {/* Konten Utama */}
      <main className="flex-1 min-w-0 px-8 py-6 lg:ml-[260px] overflow-y-auto">
        {/* Header Dasbor */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Monthly Cost Dashboard
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">
              Ringkasan kinerja biaya bulanan dan anomali utama langsung dari database
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Tombol Ekspor Ringkasan */}
            <button
              onClick={handleAsyncExport}
              disabled={exportState === "queueing"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              {exportState === "queueing" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600" />
              ) : (
                <Download className="h-3.5 w-3.5 text-slate-600" />
              )}
              <span>Ekspor Ringkasan</span>
            </button>

            {/* Tombol Sinkronkan Supabase */}
            <button
              onClick={fetchSupabaseData}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-600 ${isSyncing ? "animate-spin" : ""}`} />
              <span>Sinkronkan Supabase</span>
            </button>

            {/* Tombol Notifikasi Lonceng & Popover */}
            <div className="relative">
              <button
                aria-label="Lihat Notifikasi"
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className={`relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 ${
                  isNotificationOpen ? "ring-2 ring-[#0a7ebf]" : ""
                }`}
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
              </button>

              <NotificationPopover
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
                transactions={filteredTransactions}
                periode={currentLivePeriod}
                onViewAllExceptions={() => router.push("/cost-exception")}
              />
            </div>

            {/* Badge Periode Aktif Real-Time */}
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#e0f2fe] px-3 py-1.5 text-xs font-semibold text-[#0284c7]">
              <CalendarDays className="h-3.5 w-3.5 text-[#0284c7]" />
              {currentLivePeriod}
            </span>
          </div>
        </div>

        {/* Notifikasi Hasil Ekspor Ringkasan */}
        {exportState === "ready" && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-900">
                Laporan Ringkasan Biaya (#{exportJobId}) siap diunduh.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadExcelFiles}
                className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow hover:bg-emerald-700 transition"
              >
                Unduh .xlsx
              </button>
              <button
                onClick={() => setExportState("idle")}
                className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Filter Bar: Periode, Customer, Cabang Operasional (Label Sesuai QA & FR-001) */}
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <div className="w-52">
            <CustomDropdown
              label="Periode"
              value={periode}
              options={dynamicPeriodeOptions}
              onChange={setPeriode}
            />
          </div>

          <div className="w-64">
            <CustomDropdown
              label="Customer"
              value={customer}
              options={dynamicCustomerOptions}
              onChange={setCustomer}
            />
          </div>

          <div className="w-56">
            <CustomDropdown
              label="Cabang Operasional"
              value={cabang}
              options={dynamicCabangOptions}
              onChange={setCabang}
            />
          </div>

          <button
            onClick={handleApplyFilter}
            disabled={isFiltering}
            className="inline-flex h-[38px] items-center justify-center gap-2 rounded-lg bg-[#0a7ebf] px-5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#08689d] active:scale-95 disabled:opacity-75"
          >
            {isFiltering ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <SlidersHorizontal className="h-3.5 w-3.5" />
            )}
            <span>Terapkan Filter</span>
          </button>
        </div>

        {/* Baris 1: 4 Kartu KPI Makro (Dengan Skeleton Loading) */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {isLoading ? (
            <>
              <KpiSkeletonCard />
              <KpiSkeletonCard />
              <KpiSkeletonCard />
              <KpiSkeletonCard />
            </>
          ) : (
            <>
              {/* Card 1: TOTAL COST */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    TOTAL COST
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e0f2fe] text-[#0a7ebf]">
                    <CreditCard className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">
                    {kpiData.totalActualDisplay}
                  </h2>
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-[#ffe4e6] text-[#e11d48]">
                    {kpiData.variancePercent}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {kpiData.verifiedCountText}
                </p>
              </div>

              {/* Card 2: BUDGET */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    BUDGET
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#dcfce7] text-[#16a34a]">
                    <Landmark className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">
                    {kpiData.totalPlannedDisplay}
                  </h2>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Realisasi {kpiData.realisasiPercent}
                </p>
              </div>

              {/* Card 3: VARIANCE */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    VARIANCE
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ffe4e6] text-[#e11d48]">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">
                    {kpiData.totalVarianceDisplay}
                  </h2>
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-[#ffe4e6] text-[#e11d48]">
                    {kpiData.varianceCardPercent}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Di atas budget bulan ini
                </p>
              </div>

              {/* Card 4: TOTAL CUSTOMER */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    TOTAL CUSTOMER
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fef3c7] text-[#d97706]">
                    <Users className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">
                    {kpiData.totalCustomer}
                  </h2>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {kpiData.attentionCustomerText}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Baris 2: Budget vs Actual & Breakdown Cost per Customer */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-7">
            {isLoading ? (
              <SectionSkeletonCard height="h-80" />
            ) : (
              <BudgetChart transactions={filteredTransactions} />
            )}
          </div>
          <div className="xl:col-span-5">
            {isLoading ? (
              <SectionSkeletonCard height="h-80" />
            ) : (
              <CustomerBreakdown transactions={filteredTransactions} />
            )}
          </div>
        </div>

        {/* Baris 3: Ringkasan Exception & Kesehatan Data */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-7">
            {isLoading ? (
              <SectionSkeletonCard height="h-72" />
            ) : (
              <ExceptionSummary transactions={filteredTransactions} />
            )}
          </div>
          <div className="xl:col-span-5">
            {isLoading ? (
              <SectionSkeletonCard height="h-72" />
            ) : (
              <DataHealth transactions={filteredTransactions} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}