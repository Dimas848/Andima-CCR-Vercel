"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  AlertTriangle,
  TrendingUp,
  Flame,
  ShieldAlert,
  Search,
  ChevronRight,
  X,
  Sliders,
  SlidersHorizontal,
  AlertCircle,
  ArrowRight,
  FileText,
  CheckCircle2,
} from "lucide-react";

import Sidebar from "@/components/sidebar";
import { supabase } from "@/lib/supabase";

export type AnomalyTag = "Over Budget" | "High Cost" | "Missing Evidence" | "Duplicate Data";
export type ExceptionPriority = "Critical" | "High" | "Medium" | "Low";
export type ExceptionStatus = "Terbuka" | "Ditinjau" | "Dalam Proses" | "Selesai";

export interface ExceptionItem {
  id: string;
  dbId: string;
  customer: string;
  jobNumber?: string;
  nominal: number;
  tipeMasalah: AnomalyTag;
  prioritas: ExceptionPriority;
  status: ExceptionStatus;
  slaExceeded?: boolean;
}

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

function getDynamicPeriod(): string {
  const d = new Date();
  return `${MONTH_NAMES_ID[d.getMonth()]} ${d.getFullYear()}`;
}

function formatRupiah(value: number): string {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function formatCompactRupiah(val: number): string {
  if (Math.abs(val) >= 1_000_000_000) {
    return `Rp ${(val / 1_000_000_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} M`;
  }
  if (Math.abs(val) >= 1_000_000) {
    return `Rp ${(val / 1_000_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} jt`;
  }
  return `Rp ${val.toLocaleString("id-ID")}`;
}

// =========================================================================
// SUB-KOMPONEN: NOTIFICATION POPOVER (DINAMIS & SKELETON)
// =========================================================================
interface NotificationPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  periode: string;
  totalExceptionCount: number;
  isLoading: boolean;
  categorySummaries: {
    tag: AnomalyTag;
    count: number;
    nominal: number;
    description: string;
    subNote: string;
    icon: typeof TrendingUp;
    bgColor: string;
    textColor: string;
    badgeBg: string;
  }[];
}

function NotificationPopover({
  isOpen,
  onClose,
  periode,
  totalExceptionCount,
  isLoading,
  categorySummaries,
}: NotificationPopoverProps) {
  const [activeTab, setActiveTab] = useState<"semua" | "belum_dibaca">("semua");
  const [isMarkedAllRead, setIsMarkedAllRead] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/5" onClick={onClose} />
      <div className="absolute right-0 top-11 z-50 w-[380px] rounded-2xl border border-slate-200/90 bg-white shadow-2xl animate-in fade-in slide-in-from-top-2 text-left">
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

          {isLoading ? (
            <div className="mt-2 space-y-1.5 animate-pulse">
              <div className="h-3.5 w-40 rounded bg-slate-200" />
              <div className="h-2.5 w-28 rounded bg-slate-100" />
            </div>
          ) : (
            <>
              <p className="mt-2 text-xs font-bold text-slate-800">
                {totalExceptionCount} exception perlu tindak lanjut
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Ringkasan exception · {periode}
              </p>
            </>
          )}

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

        <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
          {isLoading ? (
            <div className="space-y-4 p-5">
              {[1, 2, 3].map((idx) => (
                <div key={idx} className="flex gap-3 animate-pulse">
                  <div className="h-9 w-9 rounded-xl bg-slate-200 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between">
                      <div className="h-3.5 w-24 rounded bg-slate-200" />
                      <div className="h-3.5 w-12 rounded bg-slate-200" />
                    </div>
                    <div className="h-4 w-20 rounded bg-slate-200" />
                    <div className="h-3 w-full rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : activeTab === "belum_dibaca" && isMarkedAllRead ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Semua notifikasi telah ditandai dibaca.
            </div>
          ) : categorySummaries.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Tidak ada anomali biaya saat ini.
            </div>
          ) : (
            categorySummaries.map((cat) => {
              const IconComp = cat.icon;
              return (
                <div key={cat.tag} className="flex gap-3.5 p-5 transition hover:bg-slate-50/60">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cat.bgColor} ${cat.textColor}`}>
                    <IconComp className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-900">{cat.tag}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cat.badgeBg} ${cat.textColor}`}>
                        {cat.count} item
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-900">{formatCompactRupiah(cat.nominal)}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      {cat.description}
                    </p>
                    <span className={`mt-2 block text-[11px] font-bold ${cat.textColor}`}>
                      {cat.subNote}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="rounded-b-2xl bg-[#edf8fd] p-3 text-center border-t border-sky-100/60">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0a7ebf] transition hover:text-[#08689d]"
          >
            <span>Tutup notifikasi</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}

// =========================================================================
// KOMPONEN UTAMA: COST EXCEPTION & ALERT
// =========================================================================
export default function CostExceptionPage() {
  const router = useRouter();
  const currentLivePeriod = useMemo(() => getDynamicPeriod(), []);

  // State Dinamis
  const [data, setData] = useState<ExceptionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("Semua Tipe");
  const [selectedStatus, setSelectedStatus] = useState<string>("Semua Status");
  const [isSlaFilterActive, setIsSlaFilterActive] = useState<boolean>(false);

  // State Popover & Rule Modal
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [ruleBudgetVariance, setRuleBudgetVariance] = useState("5");
  const [ruleHighCostLimit, setRuleHighCostLimit] = useState("50000000");

  // Pagination State: Tepat 6 baris per view
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Tarik Data Live dari Supabase View c2_cost_transactions
  const fetchExceptionsFromSupabase = useCallback(async () => {
    try {
      setIsSyncing(true);
      const { data: records, error } = await supabase
        .from("c2_cost_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !records || records.length === 0) {
        setData([]);
        return;
      }

      const anomalyRecords = records.filter(
        (item) => item.review_flag || item.variance > 0 || !item.has_evidence || !item.is_job_matched
      );

      if (anomalyRecords.length === 0) {
        setData([]);
        return;
      }

      const formatted: ExceptionItem[] = anomalyRecords.map((item, idx) => {
        let tag: AnomalyTag = "Over Budget";
        let prio: ExceptionPriority = "High";
        const actual = Number(item.actual_cost || 0);
        const variance = Number(item.variance || 0);

        // Hierarki Klasifikasi Mutually Exclusive Selaras Dashboard & FR-003
        if (!item.is_job_matched || item.job_number === "UNMATCHED" || item.job_number === "-" || !item.job_number) {
          tag = "Duplicate Data";
          prio = "Critical";
        } else if (!item.has_evidence) {
          tag = "Missing Evidence";
          prio = "High";
        } else if (variance > 0) {
          tag = "Over Budget";
          prio = variance > 20_000_000 ? "Critical" : "High";
        } else if (actual >= Number(ruleHighCostLimit)) {
          tag = "High Cost";
          prio = "Critical";
        }

        const stat: ExceptionStatus = item.review_flag
          ? "Terbuka"
          : (item.status as ExceptionStatus) || "Ditinjau";

        const createdTime = new Date(item.created_at || Date.now()).getTime();
        const isSlaExceeded = (Date.now() - createdTime > 24 * 60 * 60 * 1000) && stat !== "Selesai";

        const generatedId = item.code || (item.id ? `EXC-${String(item.id).slice(-4).toUpperCase()}` : `EXC-${String(idx + 1).padStart(4, "0")}`);

        return {
          id: generatedId,
          dbId: item.id || `db-${idx}`,
          customer: item.customer_name || "Tanpa Nama Customer",
          jobNumber: item.job_number || "-",
          nominal: actual,
          tipeMasalah: tag,
          prioritas: prio,
          status: stat,
          slaExceeded: isSlaExceeded,
        };
      });

      setData(formatted);
    } catch (err) {
      console.error(err);
      setData([]);
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, [ruleHighCostLimit]);

  useEffect(() => {
    fetchExceptionsFromSupabase();
  }, [fetchExceptionsFromSupabase]);

  // Handler "Tinjau Sekarang": Langsung menyaring tabel secara instan tanpa pop-up
  const handleTinjauSla = () => {
    setIsSlaFilterActive((prev) => !prev);
    setSelectedTag("Semua Tipe");
    setSelectedStatus("Semua Status");
    setSearch("");
    setCurrentPage(1);

    setTimeout(() => {
      document.getElementById("daftar-exception-table")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Kalkulasi Metrik Dinamis
  const metrics = useMemo(() => {
    const total = data.length;
    const overBudgetItems = data.filter((d) => d.tipeMasalah === "Over Budget");
    const highCostItems = data.filter((d) => d.tipeMasalah === "High Cost");
    const missingEvidenceItems = data.filter((d) => d.tipeMasalah === "Missing Evidence");
    const duplicateItems = data.filter((d) => d.tipeMasalah === "Duplicate Data");
    const dataQualityItems = [...missingEvidenceItems, ...duplicateItems];

    const overBudgetNominal = overBudgetItems.reduce((acc, curr) => acc + curr.nominal, 0);

    const slaItems = data.filter((d) => d.slaExceeded && d.status !== "Selesai");
    const slaNominal = slaItems.reduce((acc, curr) => acc + curr.nominal, 0);

    const criticalCount = data.filter((d) => d.prioritas === "Critical").length;
    const highCount = data.filter((d) => d.prioritas === "High").length;
    const mediumCount = data.filter((d) => d.prioritas === "Medium").length;
    const lowCount = data.filter((d) => d.prioritas === "Low").length;

    return {
      total,
      overBudgetCount: overBudgetItems.length,
      overBudgetNominal,
      highCostCount: highCostItems.length,
      dataQualityCount: dataQualityItems.length,
      missingEvidenceCount: missingEvidenceItems.length,
      duplicateCount: duplicateItems.length,
      criticalSlaCount: slaItems.length,
      slaNominal,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
    };
  }, [data]);

  // Ringkasan Kategori Dinamis
  const categorySummaries = useMemo(() => {
    const categories: {
      tag: AnomalyTag;
      count: number;
      nominal: number;
      description: string;
      subNote: string;
      icon: typeof TrendingUp;
      bgColor: string;
      textColor: string;
      badgeBg: string;
    }[] = [];

    const overBudget = data.filter((d) => d.tipeMasalah === "Over Budget");
    if (overBudget.length > 0) {
      categories.push({
        tag: "Over Budget",
        count: overBudget.length,
        nominal: overBudget.reduce((sum, item) => sum + item.nominal, 0),
        description: "Realisasi biaya melebihi budget. Tinjau penyebab selisih dan kesesuaian anggaran.",
        subNote: "Prioritas review anggaran",
        icon: TrendingUp,
        bgColor: "bg-rose-50",
        textColor: "text-[#e11d48]",
        badgeBg: "bg-rose-50",
      });
    }

    const highCost = data.filter((d) => d.tipeMasalah === "High Cost");
    if (highCost.length > 0) {
      categories.push({
        tag: "High Cost",
        count: highCost.length,
        nominal: highCost.reduce((sum, item) => sum + item.nominal, 0),
        description: "Biaya tunggal di atas threshold rule. Periksa kewajaran nominal dan detail transaksi.",
        subNote: "Perlu peninjauan biaya",
        icon: AlertCircle,
        bgColor: "bg-rose-50",
        textColor: "text-[#e11d48]",
        badgeBg: "bg-rose-50",
      });
    }

    const missingEvidence = data.filter((d) => d.tipeMasalah === "Missing Evidence");
    if (missingEvidence.length > 0) {
      categories.push({
        tag: "Missing Evidence",
        count: missingEvidence.length,
        nominal: missingEvidence.reduce((sum, item) => sum + item.nominal, 0),
        description: "Dokumen bukti belum lengkap. Lengkapi kuitansi yang valid untuk verifikasi biaya.",
        subNote: "Perlu kelengkapan dokumen",
        icon: FileText,
        bgColor: "bg-amber-50",
        textColor: "text-amber-600",
        badgeBg: "bg-amber-50",
      });
    }

    const duplicate = data.filter((d) => d.tipeMasalah === "Duplicate Data");
    if (duplicate.length > 0) {
      categories.push({
        tag: "Duplicate Data",
        count: duplicate.length,
        nominal: duplicate.reduce((sum, item) => sum + item.nominal, 0),
        description: "Nomor job atau data transaksi berpotensi duplikat atau belum terdaftar.",
        subNote: "Perlu verifikasi data",
        icon: ShieldAlert,
        bgColor: "bg-purple-50",
        textColor: "text-purple-600",
        badgeBg: "bg-purple-50",
      });
    }

    return categories;
  }, [data]);

  // Filter Bar Dinamis
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchSearch =
        item.customer.toLowerCase().includes(search.toLowerCase()) ||
        item.id.toLowerCase().includes(search.toLowerCase()) ||
        (item.jobNumber && item.jobNumber.toLowerCase().includes(search.toLowerCase()));

      const matchTag = selectedTag === "Semua Tipe" || item.tipeMasalah === selectedTag;
      const matchStatus = selectedStatus === "Semua Status" || item.status === selectedStatus;
      const matchSla = !isSlaFilterActive || (item.slaExceeded && item.status !== "Selesai");

      return matchSearch && matchTag && matchStatus && matchSla;
    });
  }, [data, search, selectedTag, selectedStatus, isSlaFilterActive]);

  // Paginasi: Tepat 6 baris per view, maksimal 4 nomor navigasi
  const totalItems = filteredData.length;
  const totalPages = Math.min(4, Math.max(1, Math.ceil(totalItems / itemsPerPage)));

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const getTagPillClass = (tag: AnomalyTag) => {
    switch (tag) {
      case "Over Budget":
        return "bg-[#ffe4e6] text-[#e11d48]";
      case "High Cost":
        return "bg-[#fce7f3] text-[#db2777]";
      case "Missing Evidence":
        return "bg-[#fef3c7] text-[#d97706]";
      case "Duplicate Data":
        return "bg-[#ede9fe] text-[#7c3aed]";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const getPriorityPillClass = (prio: ExceptionPriority) => {
    switch (prio) {
      case "Critical":
        return "bg-[#ffe4e6] text-[#e11d48]";
      case "High":
        return "bg-[#fce7f3] text-[#e11d48]";
      case "Medium":
        return "bg-[#fef3c7] text-[#d97706]";
      case "Low":
        return "bg-[#f1f5f9] text-[#64748b]";
    }
  };

  const getStatusPillClass = (status: ExceptionStatus) => {
    switch (status) {
      case "Terbuka":
        return "bg-[#e0f2fe] text-[#0284c7]";
      case "Ditinjau":
        return "bg-[#fef3c7] text-[#d97706]";
      case "Dalam Proses":
        return "bg-[#ede9fe] text-[#7c3aed]";
      case "Selesai":
        return "bg-[#dcfce7] text-[#16a34a]";
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f4f7fc]">
      {/* Sidebar Navigasi */}
      <Sidebar />

      {/* Konten Utama */}
      <main className="flex-1 lg:ml-[260px] min-w-0 px-8 py-6 overflow-y-auto">
        {/* Header Modul */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Cost Exception & Alert
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">
              Deteksi otomatis anomali dan kelengkapan data biaya
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Tombol Sinkronkan Supabase */}
            <button
              onClick={fetchExceptionsFromSupabase}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <SlidersHorizontal className={`h-3.5 w-3.5 text-slate-600 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Menyinkronkan..." : "Sinkronkan Supabase"}</span>
            </button>

            {/* Tombol Atur Rule Alert */}
            <button
              onClick={() => setIsRuleModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Sliders className="h-3.5 w-3.5 text-slate-600" />
              <span>Atur Rule Alert</span>
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
                {metrics.total > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
                )}
              </button>

              <NotificationPopover
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
                periode={currentLivePeriod}
                totalExceptionCount={metrics.total}
                isLoading={isLoading}
                categorySummaries={categorySummaries}
              />
            </div>

            {/* Badge Periode Aktif Real-Time */}
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#e0f2fe] px-3 py-1.5 text-xs font-semibold text-[#0284c7]">
              <CalendarDays className="h-3.5 w-3.5 text-[#0284c7]" />
              {currentLivePeriod}
            </span>
          </div>
        </div>

        {/* 4 Kartu KPI Makro (dengan Skeleton) */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
                <div className="flex items-start justify-between">
                  <div className="h-3 w-24 rounded bg-slate-200" />
                  <div className="h-7 w-7 rounded-lg bg-slate-200" />
                </div>
                <div className="mt-3 h-7 w-16 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-32 rounded bg-slate-100" />
              </div>
            ))
          ) : (
            <>
              {/* TOTAL EXCEPTION */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    TOTAL EXCEPTION
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ffe4e6] text-[#e11d48]">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-slate-900">{metrics.total}</h2>
                  {metrics.criticalCount > 0 && (
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-[#ffe4e6] text-[#e11d48]">
                      +{metrics.criticalCount}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {metrics.criticalCount} transaksi berisiko tinggi
                </p>
              </div>

              {/* OVER BUDGET */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    OVER BUDGET
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ffe4e6] text-[#e11d48]">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-2xl font-bold text-slate-900">{metrics.overBudgetCount}</h2>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Total {formatCompactRupiah(metrics.overBudgetNominal)}
                </p>
              </div>

              {/* HIGH COST */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    HIGH COST
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fef3c7] text-[#d97706]">
                    <Flame className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-2xl font-bold text-slate-900">{metrics.highCostCount}</h2>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">Di atas threshold rule</p>
              </div>

              {/* DATA QUALITY */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    DATA QUALITY
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e0f2fe] text-[#0284c7]">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-2xl font-bold text-slate-900">{metrics.dataQualityCount}</h2>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {metrics.missingEvidenceCount} evidence · {metrics.duplicateCount} duplikasi
                </p>
              </div>
            </>
          )}
        </div>

        {/* Baris SLA Alert & Distribusi Prioritas */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
          {isLoading ? (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="h-11 w-11 rounded-full bg-slate-200" />
                  <div className="space-y-2">
                    <div className="h-4 w-48 rounded bg-slate-200" />
                    <div className="h-3 w-64 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="h-8 w-28 rounded-lg bg-slate-200" />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse">
                <div className="h-4 w-32 rounded bg-slate-200" />
                <div className="mt-4 flex justify-between">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <div className="h-4 w-12 rounded-full bg-slate-200" />
                      <div className="h-6 w-6 rounded bg-slate-200" />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Banner SLA 24 Jam dengan Aksi Filter Otomatis */}
              {metrics.criticalSlaCount > 0 ? (
                <div className="flex items-center justify-between rounded-xl border border-[#fecdd3] bg-[#fff1f2] p-5 shadow-sm">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e11d48] text-white shadow-sm">
                      <AlertTriangle className="h-5 w-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#9f1239]">
                        {metrics.criticalSlaCount} exception kritis melewati SLA 24 jam
                      </h3>
                      <p className="mt-0.5 text-xs text-[#be123c]">
                        Nilai terdampak {formatCompactRupiah(metrics.slaNominal)}. Segera lakukan review agar proses closing tidak tertunda.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleTinjauSla}
                    className="rounded-lg bg-[#e11d48] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#be123c] active:scale-95 cursor-pointer shrink-0 ml-3"
                  >
                    {isSlaFilterActive ? "Tampilkan Semua" : "Tinjau Sekarang"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                      <CheckCircle2 className="h-5 w-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-emerald-900">
                        Tidak ada transaksi yang melebihi SLA 24 jam
                      </h3>
                      <p className="mt-0.5 text-xs text-emerald-700">
                        Semua status exception berada dalam batas waktu penanganan yang aman.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Distribusi Prioritas */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800">Distribusi Prioritas</h3>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex flex-col items-center">
                    <span className="rounded-full bg-[#ffe4e6] px-2.5 py-0.5 text-[10px] font-bold text-[#e11d48]">
                      Critical
                    </span>
                    <span className="mt-2 text-xl font-bold text-slate-900">{metrics.criticalCount}</span>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="rounded-full bg-[#ffe4e6] px-2.5 py-0.5 text-[10px] font-bold text-[#e11d48]">
                      High
                    </span>
                    <span className="mt-2 text-xl font-bold text-slate-900">{metrics.highCount}</span>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-[10px] font-bold text-[#d97706]">
                      Medium
                    </span>
                    <span className="mt-2 text-xl font-bold text-slate-900">{metrics.mediumCount}</span>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="rounded-full bg-[#f1f5f9] px-2.5 py-0.5 text-[10px] font-bold text-[#64748b]">
                      Low
                    </span>
                    <span className="mt-2 text-xl font-bold text-slate-900">{metrics.lowCount}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Tabel Daftar Exception */}
        <div id="daftar-exception-table" className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {/* Header Tabel & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Daftar Exception</h3>
                {isSlaFilterActive && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[10px] font-bold text-rose-700">
                    <span>SLA &gt; 24 Jam ({filteredData.length} item)</span>
                    <button
                      onClick={() => setIsSlaFilterActive(false)}
                      className="hover:text-rose-950 font-bold"
                      title="Hapus filter SLA"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Data real-time disinkronkan dengan database Supabase
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Input Pencarian */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-700" />
                <input
                  type="text"
                  placeholder="Cari customer atau ID..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-56 rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs font-medium text-slate-900 placeholder:text-slate-500 outline-none focus:border-[#0a7ebf] focus:ring-1 focus:ring-[#0a7ebf]"
                />
              </div>

              {/* Dropdown Filter Tipe Masalah */}
              <select
                value={selectedTag}
                onChange={(e) => {
                  setSelectedTag(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#0a7ebf]"
              >
                <option value="Semua Tipe">Semua Tipe</option>
                <option value="Over Budget">Over Budget</option>
                <option value="High Cost">High Cost</option>
                <option value="Missing Evidence">Missing Evidence</option>
                <option value="Duplicate Data">Duplicate Data</option>
              </select>

              {/* Dropdown Filter Status */}
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#0a7ebf]"
              >
                <option value="Semua Status">Semua Status</option>
                <option value="Terbuka">Terbuka</option>
                <option value="Ditinjau">Ditinjau</option>
                <option value="Dalam Proses">Dalam Proses</option>
                <option value="Selesai">Selesai</option>
              </select>
            </div>
          </div>

          {/* Tabel Baris Anomali (Tepat 6 Baris Sesuai Batasan) */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400">
                  <th className="py-3 px-3">ID</th>
                  <th className="py-3 px-3">CUSTOMER</th>
                  <th className="py-3 px-3">NOMINAL</th>
                  <th className="py-3 px-3">TIPE MASALAH</th>
                  <th className="py-3 px-3">PRIORITAS</th>
                  <th className="py-3 px-3">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-3.5 px-3">
                        <div className="h-4 w-16 rounded bg-slate-200" />
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="h-4 w-36 rounded bg-slate-200" />
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="h-4 w-24 rounded bg-slate-200" />
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="h-5 w-20 rounded-full bg-slate-200" />
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="h-5 w-16 rounded-full bg-slate-200" />
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="h-5 w-16 rounded-full bg-slate-200" />
                      </td>
                    </tr>
                  ))
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                      {isSlaFilterActive
                        ? "Tidak ada data exception yang melebihi batas waktu SLA 24 jam."
                        : "Tidak ada data exception yang ditemukan di Supabase."}
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((row) => (
                    <tr key={row.dbId} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-3 font-mono font-medium text-slate-500">
                        {row.id}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-slate-800">
                        {row.customer}
                      </td>
                      <td className="py-3.5 px-3 font-medium text-slate-900">
                        {formatRupiah(row.nominal)}
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${getTagPillClass(
                            row.tipeMasalah
                          )}`}
                        >
                          {row.tipeMasalah}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${getPriorityPillClass(
                            row.prioritas
                          )}`}
                        >
                          {row.prioritas}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${getStatusPillClass(
                            row.status
                          )}`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Pagination: Terkunci Tepat Maksimal 4 Angka (1 2 3 4 >) */}
          <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-100">
            {isLoading ? (
              <>
                <div className="h-3 w-44 rounded bg-slate-200 animate-pulse" />
                <div className="h-6 w-32 rounded-full bg-slate-200 animate-pulse" />
              </>
            ) : (
              <>
                <p className="text-xs text-slate-400">
                  Menampilkan {totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}–
                  {Math.min(currentPage * itemsPerPage, totalItems)} dari {totalItems} exception
                </p>

                <div className="flex items-center rounded-full border border-sky-400/80 bg-white px-3 py-1 gap-2.5 shadow-xs">
                  {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((num) => (
                    <button
                      key={num}
                      onClick={() => setCurrentPage(num)}
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold transition ${
                        currentPage === num
                          ? "bg-[#0a7ebf] text-white font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {num}
                    </button>
                  ))}

                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    className="text-[#0a7ebf] transition hover:text-[#08689d] disabled:opacity-30 ml-0.5"
                    title="Halaman Berikutnya"
                  >
                    <ChevronRight className="h-3.5 w-3.5 stroke-[2.5]" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Modal Konfigurasi Rule Alert */}
        {isRuleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-[#0a7ebf]">
                    <Sliders className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Konfigurasi Rule Alert Biaya</h3>
                    <p className="text-[11px] text-slate-400">Parameter klasifikasi anomali otomatis</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsRuleModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700">Batas Toleransi Over Budget (%)</label>
                  <input
                    type="number"
                    value={ruleBudgetVariance}
                    onChange={(e) => setRuleBudgetVariance(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#0a7ebf]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Threshold High Cost Tunggal (Rp)</label>
                  <input
                    type="number"
                    value={ruleHighCostLimit}
                    onChange={(e) => setRuleHighCostLimit(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#0a7ebf]"
                  />
                </div>

                <div className="rounded-lg bg-sky-50/70 p-3 text-[11px] text-sky-800 border border-sky-100">
                  <p className="font-bold">Ketentuan Rule Engine:</p>
                  <p className="mt-0.5 leading-relaxed">
                    • Missing Evidence otomatis mendeteksi kuitansi kosong.<br />
                    • Duplicate Data otomatis mendeteksi nomor job tidak terdaftar.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => setIsRuleModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    setIsRuleModalOpen(false);
                    fetchExceptionsFromSupabase();
                  }}
                  className="rounded-lg bg-[#0a7ebf] px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#08689d]"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}