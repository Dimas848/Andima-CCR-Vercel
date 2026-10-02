"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Bell,
  CalendarDays,
  Settings,
  AlertTriangle,
  TrendingUp,
  Flame,
  Info,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  Sliders,
  ShieldCheck,
  Loader2,
  RefreshCw,
} from "lucide-react";

import Sidebar from "../dashboard/Sidebar";
import CustomButton from "../dashboard/CustomButton";
import StatusBadge, { type Tone } from "../dashboard/StatusBadge";
import { supabase } from "@/lib/supabase";

// Tipe Data Sesuai Model Data TR-2909-003 & Skema Supabase c2_cost_transactions
export type AnomalyTag = "OVER_BUDGET" | "MISSING_EVIDENCE" | "JOB_NOT_FOUND" | "HIGH_COST";
export type ExceptionPriority = "Critical" | "High" | "Medium" | "Low";
export type ExceptionStatus = "Terbuka" | "Ditinjau" | "Selesai";

export interface ExceptionItem {
  id: string;
  dbId: string;
  transactionId: string;
  jobNumber: string;
  customer: string;
  branch: string;
  budgetAmount: number;
  actualAmount: number;
  varianceAmount: number;
  tags: AnomalyTag[];
  priority: ExceptionPriority;
  status: ExceptionStatus;
  createdAt: string;
  slaExceeded: boolean;
  resolutionNotes?: string;
  resolvedBy?: string;
}

// Fallback Data Riil PT Andima jika database belum terhubung
const fallbackExceptions: ExceptionItem[] = [
  {
    id: "EXC-001",
    dbId: "mock-1",
    transactionId: "2606-006",
    jobNumber: "BI/2608/3801",
    customer: "PT CEVA AIR OCEAN INDONESIA",
    branch: "Surabaya",
    budgetAmount: 77050,
    actualAmount: 95000,
    varianceAmount: 17950,
    tags: ["OVER_BUDGET", "MISSING_EVIDENCE"],
    priority: "High",
    status: "Terbuka",
    createdAt: "2026-09-30 08:30",
    slaExceeded: true,
  },
  {
    id: "EXC-002",
    dbId: "mock-2",
    transactionId: "BR26-06015",
    jobNumber: "DSVIMP/2608/2818",
    customer: "PT DSV TRANSPORT INDONESIA",
    branch: "Jakarta Pusat",
    budgetAmount: 50000,
    actualAmount: 180930,
    varianceAmount: 130930,
    tags: ["OVER_BUDGET"],
    priority: "Medium",
    status: "Terbuka",
    createdAt: "2026-09-30 11:15",
    slaExceeded: false,
  },
  {
    id: "EXC-003",
    dbId: "mock-3",
    transactionId: "2606-018",
    jobNumber: "JOB-UNKNOWN-001",
    customer: "PT CEVA AIR OCEAN INDONESIA",
    branch: "Jakarta Pusat",
    budgetAmount: 0,
    actualAmount: 500000,
    varianceAmount: 500000,
    tags: ["JOB_NOT_FOUND", "MISSING_EVIDENCE"],
    priority: "Critical",
    status: "Terbuka",
    createdAt: "2026-09-29 09:00",
    slaExceeded: true,
  },
  {
    id: "EXC-004",
    dbId: "mock-4",
    transactionId: "2606-018",
    jobNumber: "BI/2608/3782",
    customer: "PT CEVA AIR OCEAN INDONESIA",
    branch: "Jakarta Pusat",
    budgetAmount: 50242525,
    actualAmount: 52000000,
    varianceAmount: 1757475,
    tags: ["OVER_BUDGET", "HIGH_COST", "MISSING_EVIDENCE"],
    priority: "Critical",
    status: "Ditinjau",
    createdAt: "2026-09-28 14:20",
    slaExceeded: true,
    resolutionNotes: "Menunggu lampiran invoice fisik dari gudang Garuda",
    resolvedBy: "Kak Dian (Tax Manager)",
  },
];

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CostExceptionPage() {
  const [data, setData] = useState<ExceptionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedBranch, setSelectedBranch] = useState<string>("ALL");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Modal Review & Resolution (TR-2909-003)
  const [activeItem, setActiveItem] = useState<ExceptionItem | null>(null);
  const [inputResolutionNotes, setInputResolutionNotes] = useState("");
  const [isSubmittingResolution, setIsSubmittingResolution] = useState(false);

  // Modal Settings Rule Alert
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [ruleBudgetVariance, setRuleBudgetVariance] = useState("5");
  const [ruleHighCostLimit, setRuleHighCostLimit] = useState("50000000");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Tarik Data Transaksi Bermasalah Langsung dari Supabase
  const fetchExceptionsFromSupabase = async () => {
    try {
      setIsLoading(true);
      const { data: records, error } = await supabase
        .from("c2_cost_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !records || records.length === 0) {
        console.warn("Memuat data exception lokal (fallback)...");
        setData(fallbackExceptions);
        return;
      }

      // Transformasi baris c2_cost_transactions menjadi ExceptionItem
      const formatted: ExceptionItem[] = records
        .filter((item) => item.review_flag || item.reconciliation_result !== "MATCH" || !item.has_evidence)
        .map((item, idx) => {
          const tags: AnomalyTag[] = [];
          const variance = Number(item.variance || (item.actual_cost - item.planned_cost) || 0);
          const actual = Number(item.actual_cost || 0);
          const planned = Number(item.planned_cost || 0);

          if (item.job_number === "UNMATCHED" || item.reconciliation_result === "JOB_NOT_FOUND" || planned === 0) {
            tags.push("JOB_NOT_FOUND");
          }
          if (variance > 0) {
            tags.push("OVER_BUDGET");
          }
          if (!item.has_evidence && actual > 0) {
            tags.push("MISSING_EVIDENCE");
          }
          if (actual >= Number(ruleHighCostLimit)) {
            tags.push("HIGH_COST");
          }

          // Klasifikasi Tingkat Keparahan (Priority)
          let priority: ExceptionPriority = "Low";
          if (tags.includes("JOB_NOT_FOUND") || actual >= 50000000) {
            priority = "Critical";
          } else if (tags.includes("OVER_BUDGET") || variance > 500000) {
            priority = "High";
          } else if (tags.includes("MISSING_EVIDENCE")) {
            priority = "Medium";
          }

          const createdDate = new Date(item.created_at || Date.now());
          const isOlderThan24h = Date.now() - createdDate.getTime() > 24 * 60 * 60 * 1000;

          return {
            id: `EXC-${String(idx + 1).padStart(3, "0")}`,
            dbId: item.id,
            transactionId: item.voucher_no || `TRX-${String(idx + 1).padStart(4, "0")}`,
            jobNumber: item.job_number,
            customer: item.customer_name || "PT Unknown Customer",
            branch: item.branch_code || "Jakarta Pusat",
            budgetAmount: planned,
            actualAmount: actual,
            varianceAmount: variance,
            tags: tags.length > 0 ? tags : ["OVER_BUDGET"],
            priority,
            status: item.review_flag ? "Terbuka" : "Selesai",
            createdAt: createdDate.toLocaleDateString("id-ID", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }),
            slaExceeded: isOlderThan24h && item.review_flag,
            resolutionNotes: item.description,
          };
        });

      setData(formatted.length > 0 ? formatted : fallbackExceptions);
    } catch (err) {
      console.error("Gagal sinkronisasi Supabase:", err);
      setData(fallbackExceptions);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExceptionsFromSupabase();
  }, [ruleHighCostLimit]);

  // 2. Filter Dinamis
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchSearch =
        item.customer.toLowerCase().includes(search.toLowerCase()) ||
        item.id.toLowerCase().includes(search.toLowerCase()) ||
        item.jobNumber.toLowerCase().includes(search.toLowerCase());

      const matchTag = selectedTag === "ALL" || item.tags.includes(selectedTag as AnomalyTag);
      const matchStatus = selectedStatus === "ALL" || item.status === selectedStatus;
      const matchBranch = selectedBranch === "ALL" || item.branch.includes(selectedBranch);

      return matchSearch && matchTag && matchStatus && matchBranch;
    });
  }, [data, search, selectedTag, selectedStatus, selectedBranch]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  // 3. Kalkulasi Kartu KPI Makro secara Real-Time
  const metrics = useMemo(() => {
    const unresolved = data.filter((d) => d.status !== "Selesai");
    const overBudgetItems = unresolved.filter((d) => d.tags.includes("OVER_BUDGET"));
    const highCostItems = unresolved.filter((d) => d.tags.includes("HIGH_COST"));
    const dataQualityItems = unresolved.filter(
      (d) => d.tags.includes("MISSING_EVIDENCE") || d.tags.includes("JOB_NOT_FOUND")
    );
    const criticalSlaItems = unresolved.filter((d) => d.slaExceeded);

    const totalOverBudgetNominal = overBudgetItems.reduce((acc, curr) => acc + curr.actualAmount, 0);
    const totalSlaNominal = criticalSlaItems.reduce((acc, curr) => acc + curr.actualAmount, 0);

    const distribution = {
      critical: unresolved.filter((d) => d.priority === "Critical").length,
      high: unresolved.filter((d) => d.priority === "High").length,
      medium: unresolved.filter((d) => d.priority === "Medium").length,
      low: unresolved.filter((d) => d.priority === "Low").length,
    };

    return {
      total: unresolved.length,
      overBudgetCount: overBudgetItems.length,
      overBudgetNominal: totalOverBudgetNominal,
      highCostCount: highCostItems.length,
      dataQualityCount: dataQualityItems.length,
      criticalSlaCount: criticalSlaItems.length,
      slaNominal: totalSlaNominal,
      distribution,
    };
  }, [data]);

  // 4. Aksi Resolusi Nyata ke Basis Data Supabase
  const handleResolveException = async (newStatus: ExceptionStatus) => {
    if (!activeItem) return;

    try {
      setIsSubmittingResolution(true);
      const isResolved = newStatus === "Selesai";

      // Simpan perubahan ke tabel Supabase c2_cost_transactions
      if (activeItem.dbId && !activeItem.dbId.startsWith("mock-")) {
        const { error } = await supabase
          .from("c2_cost_transactions")
          .update({
            review_flag: !isResolved,
            description: inputResolutionNotes || `Diverifikasi oleh Kak Dian (${newStatus})`,
          })
          .eq("id", activeItem.dbId);

        if (error) throw error;
      }

      // Perbarui status state lokal
      setData((prev) =>
        prev.map((item) =>
          item.id === activeItem.id
            ? {
                ...item,
                status: newStatus,
                resolutionNotes: inputResolutionNotes || item.resolutionNotes,
                resolvedBy: "Kak Dian (Tax Manager / Cost Controller)",
              }
            : item
        )
      );

      showToast(`Status anomali ${activeItem.id} berhasil diubah menjadi "${newStatus}".`);
      setActiveItem(null);
      setInputResolutionNotes("");
    } catch (err: any) {
      console.error("Gagal memperbarui status ke database:", err);
      showToast(`Gagal menyimpan ke database: ${err.message}`);
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f4f7fb]">
      <Sidebar />

      <main className="flex-1 px-8 py-6">
        {/* Header Modul */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Cost Exception & Alert</h1>
            <p className="text-xs text-slate-500">
              Deteksi otomatis anomali, klasifikasi rule engine, dan manajemen resolusi (FR-CCR2-003)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <CustomButton variant="outline" onClick={fetchExceptionsFromSupabase}>
              <RefreshCw className="h-4 w-4" /> Sinkronkan Ulang
            </CustomButton>
            <CustomButton variant="outline" onClick={() => setIsRuleModalOpen(true)}>
              <Settings className="h-4 w-4" /> Atur Rule Alert
            </CustomButton>

            <button
              aria-label="Notifikasi"
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
            </button>

            <span className="flex items-center gap-2 rounded-lg bg-sky-100 px-3 py-2.5 text-xs font-bold text-sky-700">
              <CalendarDays className="h-4 w-4 text-sky-700" /> September 2026
            </span>
          </div>
        </div>

        {/* Toast Notifikasi */}
        {toastMessage && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-bold text-emerald-900">{toastMessage}</p>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-900">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* KPI Cards Dinamis */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-bold tracking-wider text-slate-500">TOTAL EXCEPTION</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-1 flex items-center gap-3">
              <h2 className="text-2xl font-extrabold text-slate-900">{metrics.total}</h2>
              <StatusBadge value={`+${metrics.total}`} tone="danger" />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Memerlukan review (Review Flag = YES)</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-bold tracking-wider text-slate-500">OVER BUDGET</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-100 text-pink-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <h2 className="mt-1 text-2xl font-extrabold text-slate-900">{metrics.overBudgetCount}</h2>
            <p className="mt-1 text-[11px] text-slate-400">Total {formatRupiah(metrics.overBudgetNominal)}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-bold tracking-wider text-slate-500">HIGH COST</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <Flame className="h-4 w-4" />
              </div>
            </div>
            <h2 className="mt-1 text-2xl font-extrabold text-slate-900">{metrics.highCostCount}</h2>
            <p className="mt-1 text-[11px] text-slate-400">Di atas threshold {formatRupiah(Number(ruleHighCostLimit))}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-bold tracking-wider text-slate-500">DATA QUALITY</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                <Info className="h-4 w-4" />
              </div>
            </div>
            <h2 className="mt-1 text-2xl font-extrabold text-slate-900">{metrics.dataQualityCount}</h2>
            <p className="mt-1 text-[11px] text-slate-400">Missing Evidence & Job Not Found</p>
          </div>
        </div>

        {/* Alert Box SLA 24 Jam & Distribusi Prioritas */}
        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E05262] text-white">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-rose-900">
                  {metrics.criticalSlaCount} exception kritis melewati SLA 24 jam
                </p>
                <p className="mt-1 text-xs text-rose-700">
                  Akumulasi biaya anomali sebesar {formatRupiah(metrics.slaNominal)}. Segera selesaikan agar tidak menghambat penutupan buku bulanan.
                </p>
              </div>
              <CustomButton
                size="sm"
                className="bg-[#E05262] hover:bg-[#c93f4e]"
                onClick={() => {
                  setSelectedTag("OVER_BUDGET");
                  setSelectedStatus("Terbuka");
                }}
              >
                Tinjau Sekarang
              </CustomButton>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Distribusi Prioritas Anomali</h3>
            <div className="mt-4 grid grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-[11px] font-semibold text-rose-600">Critical</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900">{metrics.distribution.critical}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] font-semibold text-rose-600">High</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900">{metrics.distribution.high}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] font-semibold text-amber-600">Medium</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900">{metrics.distribution.medium}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] font-semibold text-slate-500">Low</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900">{metrics.distribution.low}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabel Exception dengan Filter */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Daftar Exception Transaksi</h3>
              <p className="text-[11px] text-slate-400">
                Data ditarik langsung dari Supabase (`c2_cost_transactions`) secara real-time
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar - Warna teks dan placeholder dipaksa kontras gelap */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari customer, ID, atau job..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-56 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              {/* Filter Cabang Operasional */}
              <select
                value={selectedBranch}
                onChange={(e) => {
                  setSelectedBranch(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400"
              >
                <option value="ALL">Semua Cabang</option>
                <option value="Jakarta">Jakarta Pusat</option>
                <option value="Surabaya">Surabaya</option>
                <option value="Semarang">Semarang</option>
              </select>

              {/* Filter Tipe Anomali */}
              <select
                value={selectedTag}
                onChange={(e) => {
                  setSelectedTag(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400"
              >
                <option value="ALL">Semua Tipe Anomali</option>
                <option value="OVER_BUDGET">Over Budget</option>
                <option value="MISSING_EVIDENCE">Missing Evidence</option>
                <option value="JOB_NOT_FOUND">Job Not Found</option>
                <option value="HIGH_COST">High Cost</option>
              </select>

              {/* Filter Status Resolusi */}
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400"
              >
                <option value="ALL">Semua Status</option>
                <option value="Terbuka">Terbuka</option>
                <option value="Ditinjau">Ditinjau</option>
                <option value="Selesai">Selesai</option>
              </select>
            </div>
          </div>

          {/* Grid Tabel Data */}
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-bold">ID Exception</th>
                  <th className="px-4 py-3 font-bold">Customer & Job</th>
                  <th className="px-4 py-3 font-bold">Cabang</th>
                  <th className="px-4 py-3 font-bold text-right">Nominal Aktual</th>
                  <th className="px-4 py-3 font-bold">Tag Anomali</th>
                  <th className="px-4 py-3 font-bold">Prioritas</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-xs text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                        <span>Menghubungkan ke Supabase...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-slate-400">
                      Tidak ada transaksi anomali yang cocok dengan kriteria filter.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((e) => {
                    const statusTone: Tone =
                      e.status === "Selesai" ? "success" : e.status === "Ditinjau" ? "warning" : "info";

                    const priorityTone: Tone =
                      e.priority === "Critical" || e.priority === "High"
                        ? "danger"
                        : e.priority === "Medium"
                        ? "warning"
                        : "success";

                    return (
                      <tr key={e.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3 font-semibold text-slate-600 text-xs">
                          {e.id}
                          {e.slaExceeded && e.status !== "Selesai" && (
                            <span className="block text-[9px] font-bold text-rose-600 mt-0.5">&gt; 24 Jam SLA</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-800 text-xs">{e.customer}</p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            {e.jobNumber === "UNMATCHED" || e.jobNumber.includes("UNKNOWN") ? (
                              <span className="text-amber-600 font-bold">Job Belum Terdaftar</span>
                            ) : (
                              e.jobNumber
                            )}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-600">{e.branch}</td>
                        <td className="px-4 py-3 text-right font-extrabold text-slate-900 text-xs">
                          {formatRupiah(e.actualAmount)}
                          {e.varianceAmount > 0 && (
                            <span className="block text-[10px] font-semibold text-rose-500">
                              +{formatRupiah(e.varianceAmount)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {e.tags.map((tag) => (
                              <span
                                key={tag}
                                className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                  tag === "OVER_BUDGET"
                                    ? "bg-[#FEE2E2] text-[#E05262]"
                                    : tag === "MISSING_EVIDENCE"
                                    ? "bg-[#FEF3C7] text-[#D99A18]"
                                    : tag === "JOB_NOT_FOUND"
                                    ? "bg-[#FFEDD5] text-[#EA580C]"
                                    : "bg-purple-100 text-purple-700"
                                }`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge value={e.priority} tone={priorityTone} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge value={e.status} tone={statusTone} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => {
                              setActiveItem(e);
                              setInputResolutionNotes(e.resolutionNotes || "");
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-sky-600 shadow-sm transition hover:bg-sky-50"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[11px] text-slate-400">
              Menampilkan {filteredData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} -{" "}
              {Math.min(currentPage * itemsPerPage, filteredData.length)} dari {filteredData.length} anomali
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
              </button>

              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition ${
                    currentPage === pageNum
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Berikutnya <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Review & Tindak Lanjut Resolusi */}
        {activeItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                      {activeItem.id}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900">Review & Tindak Lanjut Anomali</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Voucher / ID Transaksi: {activeItem.transactionId}</p>
                </div>
                <button
                  onClick={() => setActiveItem(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Rincian Transaksi */}
              <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nama Customer:</span>
                  <span className="font-bold text-slate-900">{activeItem.customer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nomor Pekerjaan:</span>
                  <span className="font-mono font-bold text-slate-900">{activeItem.jobNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cabang Operasional:</span>
                  <span className="font-semibold text-slate-700">{activeItem.branch}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pagu Anggaran (Planned):</span>
                  <span className="font-bold text-slate-900">{formatRupiah(activeItem.budgetAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Realisasi Aktual:</span>
                  <span className="font-bold text-slate-900">{formatRupiah(activeItem.actualAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200/60 pt-2">
                  <span className="text-slate-500">Deviasi Biaya:</span>
                  <span className="font-extrabold text-rose-600">
                    {activeItem.varianceAmount > 0 ? `+${formatRupiah(activeItem.varianceAmount)}` : "Rp 0"}
                  </span>
                </div>
              </div>

              {/* Form Input Catatan Resolusi - Warna font dan placeholder dipaksa gelap */}
              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-700">
                  Catatan Justifikasi / Audit Trail (Resolution Notes)
                </label>
                <textarea
                  rows={3}
                  value={inputResolutionNotes}
                  onChange={(e) => setInputResolutionNotes(e.target.value)}
                  placeholder="Contoh: Bukti invoice fisik telah diverifikasi oleh tim Billing dan disetujui untuk ditutup..."
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              {/* Tombol Aksi */}
              <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <CustomButton variant="outline" size="sm" onClick={() => setActiveItem(null)}>
                  Batal
                </CustomButton>
                <CustomButton
                  variant="outline"
                  size="sm"
                  disabled={isSubmittingResolution}
                  onClick={() => handleResolveException("Ditinjau")}
                  className="text-amber-700 border-amber-200 hover:bg-amber-50"
                >
                  Tandai Ditinjau
                </CustomButton>
                <CustomButton
                  size="sm"
                  disabled={isSubmittingResolution}
                  onClick={() => handleResolveException("Selesai")}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {isSubmittingResolution ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  Selesaikan Anomali
                </CustomButton>
              </div>
            </div>
          </div>
        )}

        {/* Modal Atur Rule Alert */}
        {isRuleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                    <Sliders className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Konfigurasi Rule Alert Biaya</h3>
                    <p className="text-[11px] text-slate-400">Parameter klasifikasi anomali otomatis</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsRuleModalOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700">Batas Toleransi Over Budget (%)</label>
                  <input
                    type="number"
                    value={ruleBudgetVariance}
                    onChange={(e) => setRuleBudgetVariance(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-sky-400"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Threshold High Cost Tunggal (Rp)</label>
                  <input
                    type="number"
                    value={ruleHighCostLimit}
                    onChange={(e) => setRuleHighCostLimit(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-sky-400"
                  />
                </div>

                <div className="rounded-lg bg-sky-50 p-3 text-[11px] text-sky-800 border border-sky-100">
                  <p className="font-bold">Ketentuan Sistem Otomatis:</p>
                  <p className="mt-0.5">
                    • MISSING_EVIDENCE aktif jika kuitansi kosong.<br />
                    • JOB_NOT_FOUND otomatis aktif jika tidak ada referensi job valid di master operasional.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
                <CustomButton variant="outline" size="sm" onClick={() => setIsRuleModalOpen(false)}>
                  Batal
                </CustomButton>
                <CustomButton
                  size="sm"
                  onClick={() => {
                    setIsRuleModalOpen(false);
                    showToast("Aturan alert berhasil diperbarui dan diterapkan ke seluruh transaksi.");
                  }}
                  className="bg-[#0a7ebf] hover:bg-[#08689d]"
                >
                  Simpan Perubahan
                </CustomButton>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}