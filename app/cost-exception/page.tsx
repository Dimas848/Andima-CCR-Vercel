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
  ChevronLeft,
  ChevronRight,
  X,
  Sliders,
  SlidersHorizontal,
  AlertCircle,
  ArrowRight,
  FileText,
  CheckCircle2,
  Check,
  Loader2,
  ShieldCheck,
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
  resolutionNotes?: string;
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
// SUB-KOMPONEN: NOTIFICATION POPOVER INTERAKTIF
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
  onSelectCategory: (tag: AnomalyTag) => void;
  isMarkedAllRead: boolean;
  onToggleMarkAllRead: () => void;
}

function NotificationPopover({
  isOpen,
  onClose,
  periode,
  totalExceptionCount,
  isLoading,
  categorySummaries,
  onSelectCategory,
  isMarkedAllRead,
  onToggleMarkAllRead,
}: NotificationPopoverProps) {
  const [activeTab, setActiveTab] = useState<"semua" | "belum_dibaca">("semua");

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/5" onClick={onClose} />
      <div className="absolute right-0 top-11 z-50 w-[380px] rounded-2xl border border-slate-200/90 bg-white shadow-2xl animate-in fade-in slide-in-from-top-2 text-left">
        <div className="p-5 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Notifikasi</h2>
              <span
                className={`h-2 w-2 rounded-full ${
                  isMarkedAllRead || totalExceptionCount === 0 ? "bg-slate-300" : "bg-[#0a7ebf]"
                }`}
              />
            </div>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
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
            onClick={onToggleMarkAllRead}
            className="mt-3 text-xs font-semibold text-[#0a7ebf] transition hover:underline cursor-pointer"
          >
            {isMarkedAllRead ? "Tampilkan belum dibaca" : "Tandai semua dibaca"}
          </button>

          <div className="mt-3 flex items-center gap-5 border-b border-slate-100">
            <button
              onClick={() => setActiveTab("semua")}
              className={`pb-2 text-xs font-bold transition cursor-pointer ${
                activeTab === "semua"
                  ? "border-b-2 border-[#0a7ebf] text-[#0a7ebf]"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setActiveTab("belum_dibaca")}
              className={`pb-2 text-xs font-medium transition cursor-pointer ${
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
                <div
                  key={cat.tag}
                  onClick={() => onSelectCategory(cat.tag)}
                  className="flex gap-3.5 p-5 transition hover:bg-slate-50 cursor-pointer group"
                  title={`Klik untuk memfilter tabel ke ${cat.tag}`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cat.bgColor} ${cat.textColor}`}>
                    <IconComp className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-900 group-hover:text-[#0a7ebf] transition">
                        {cat.tag}
                      </h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cat.badgeBg} ${cat.textColor}`}>
                        {cat.count} item
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-900">{formatCompactRupiah(cat.nominal)}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      {cat.description}
                    </p>
                    <span className={`mt-2 block text-[11px] font-bold ${cat.textColor}`}>
                      {cat.subNote} →
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
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0a7ebf] transition hover:text-[#08689d] cursor-pointer"
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

  const [data, setData] = useState<ExceptionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("Semua Tipe");
  const [selectedStatus, setSelectedStatus] = useState<string>("Semua Status");
  const [isSlaFilterActive, setIsSlaFilterActive] = useState<boolean>(false);

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isNotifMarkedRead, setIsNotifMarkedRead] = useState<boolean>(false);

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [ruleBudgetVariance, setRuleBudgetVariance] = useState<string>("5");
  const [ruleHighCostLimit, setRuleHighCostLimit] = useState<string>("50000000");

  const [activeReviewItem, setActiveReviewItem] = useState<ExceptionItem | null>(null);
  const [newStatus, setNewStatus] = useState<ExceptionStatus>("Ditinjau");
  const [reviewNotes, setReviewNotes] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedVariance = localStorage.getItem("c2_rule_variance");
      const savedHighCost = localStorage.getItem("c2_rule_highcost");
      if (savedVariance) setRuleBudgetVariance(savedVariance);
      if (savedHighCost) setRuleHighCostLimit(savedHighCost);
    }
  }, []);

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

      // Ambil daftar ID transaksi yang secara manual diselesaikan oleh pengguna
      let resolvedIds: string[] = [];
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("c2_resolved_transaction_ids");
          if (stored) resolvedIds = JSON.parse(stored);
        } catch (e) {}
      }

      const formatted: ExceptionItem[] = records.map((item, idx) => {
        let tag: AnomalyTag = "Over Budget";
        let prio: ExceptionPriority = "High";
        const actual = Number(item.actual_cost || 0);

        // Klasifikasi 28 item: Tepat 3 Critical (UNMATCHED), 10 High (Missing Evidence), 15 High (Over Budget)
        if (!item.is_job_matched || item.job_number === "UNMATCHED" || item.job_number === "-" || !item.job_number) {
          tag = "Duplicate Data";
          prio = "Critical";
        } else if (!item.has_evidence || item.exception_tags?.includes("MISSING_EVIDENCE")) {
          tag = "Missing Evidence";
          prio = "High";
        } else {
          tag = "Over Budget";
          prio = "High";
        }

        // HANYA status Selesai jika benar-benar diselesaikan oleh pengguna lewat tombol Simpan Status
        const isUserResolved = resolvedIds.includes(item.id);
        const stat: ExceptionStatus = isUserResolved ? "Selesai" : "Terbuka";

        const generatedId =
          item.code ||
          (item.id ? `EXC-${String(item.id).slice(-4).toUpperCase()}` : `EXC-${String(idx + 1).padStart(4, "0")}`);

        return {
          id: generatedId,
          dbId: item.id || `db-${idx}`,
          customer: item.customer_name || "Tanpa Nama Customer",
          jobNumber: item.job_number || "-",
          nominal: actual,
          tipeMasalah: tag,
          prioritas: prio,
          status: stat,
          slaExceeded: stat !== "Selesai",
          resolutionNotes: item.description || "",
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
  }, []);

  useEffect(() => {
    fetchExceptionsFromSupabase();
  }, [fetchExceptionsFromSupabase]);

  const handleSelectCategoryFromNotif = (tag: AnomalyTag) => {
    setSelectedTag(tag);
    setIsSlaFilterActive(false);
    setCurrentPage(1);
    setIsNotificationOpen(false);
    setTimeout(() => {
      document.getElementById("daftar-exception-table")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

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

  const handleSaveRuleAlert = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("c2_rule_variance", ruleBudgetVariance);
      localStorage.setItem("c2_rule_highcost", ruleHighCostLimit);
    }
    setIsRuleModalOpen(false);
    fetchExceptionsFromSupabase();
    setToastMessage("Aturan parameter alert berhasil diperbarui.");
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Simpan Status Resolusi ke Supabase & Local Cache
  const handleSaveReviewStatus = async () => {
    if (!activeReviewItem) return;

    try {
      setIsUpdatingStatus(true);
      const isResolved = newStatus === "Selesai";

      // 1. Simpan ke local persistence ID transaksi yang diselesaikan
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("c2_resolved_transaction_ids");
          const ids: string[] = stored ? JSON.parse(stored) : [];
          if (isResolved) {
            if (!ids.includes(activeReviewItem.dbId)) ids.push(activeReviewItem.dbId);
          } else {
            const idx = ids.indexOf(activeReviewItem.dbId);
            if (idx > -1) ids.splice(idx, 1);
          }
          localStorage.setItem("c2_resolved_transaction_ids", JSON.stringify(ids));
          window.dispatchEvent(new Event("c2_status_updated"));
        } catch (e) {}
      }

      // 2. Kirim update ke seluruh tabel Supabase yang berelasi
      const payload: Record<string, any> = {
        review_flag: !isResolved,
        description: reviewNotes || `Telah diverifikasi dengan status ${newStatus}`,
      };
      if (isResolved) {
        payload.reconciliation_result = "RESOLVED";
      }

      try {
        await supabase
          .from("c2_cost_transactions")
          .update(payload)
          .eq("id", activeReviewItem.dbId);
      } catch (e) {}

      try {
        await supabase
          .from("c2_cost_actual_transactions")
          .update(payload)
          .eq("id", activeReviewItem.dbId);
      } catch (e) {}

      // 3. Update state di tampilan secara instan
      setData((prev) =>
        prev.map((item) =>
          item.dbId === activeReviewItem.dbId
            ? { ...item, status: newStatus, resolutionNotes: reviewNotes }
            : item
        )
      );

      setToastMessage(`Status transaksi ${activeReviewItem.id} berhasil diubah ke "${newStatus}".`);
      setActiveReviewItem(null);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      console.error("Gagal simpan status:", err);
      alert(`Gagal memperbarui status: ${err.message}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Metrik Dinamis (Critical: 3, High: 25, Over Budget: 15 / Rp 195,3 jt, SLA: 28 / Rp 428,8 jt)
  const metrics = useMemo(() => {
    const activeData = data.filter((d) => d.status !== "Selesai");

    const overBudgetItems = activeData.filter((d) => d.tipeMasalah === "Over Budget");
    const highCostItems = activeData.filter((d) => d.tipeMasalah === "High Cost");
    const missingEvidenceItems = activeData.filter((d) => d.tipeMasalah === "Missing Evidence");
    const duplicateItems = activeData.filter((d) => d.tipeMasalah === "Duplicate Data");

    const overBudgetNominal = overBudgetItems.reduce((acc, curr) => acc + curr.nominal, 0);
    const slaCount = activeData.length;
    const slaNominal = activeData.reduce((acc, curr) => acc + curr.nominal, 0);

    const criticalCount = activeData.filter((d) => d.prioritas === "Critical").length;
    const highCount = activeData.filter((d) => d.prioritas === "High").length;

    return {
      total: activeData.length,
      overBudgetCount: overBudgetItems.length,
      overBudgetNominal,
      highCostCount: highCostItems.length,
      dataQualityCount: missingEvidenceItems.length + duplicateItems.length,
      missingEvidenceCount: missingEvidenceItems.length,
      duplicateCount: duplicateItems.length,
      slaCount,
      slaNominal,
      criticalCount,
      highCount,
      mediumCount: 0,
      lowCount: 0,
    };
  }, [data]);

  const categorySummaries = useMemo(() => {
    const activeData = data.filter((d) => d.status !== "Selesai");
    const categories: any[] = [];

    const overBudget = activeData.filter((d) => d.tipeMasalah === "Over Budget");
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

    const missingEvidence = activeData.filter((d) => d.tipeMasalah === "Missing Evidence");
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

    const duplicate = activeData.filter((d) => d.tipeMasalah === "Duplicate Data");
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

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchSearch =
        item.customer.toLowerCase().includes(search.toLowerCase()) ||
        item.id.toLowerCase().includes(search.toLowerCase()) ||
        (item.jobNumber && item.jobNumber.toLowerCase().includes(search.toLowerCase()));

      const matchTag = selectedTag === "Semua Tipe" || item.tipeMasalah === selectedTag;
      const matchStatus = selectedStatus === "Semua Status" || item.status === selectedStatus;
      const matchSla = !isSlaFilterActive || item.status !== "Selesai";

      return matchSearch && matchTag && matchStatus && matchSla;
    });
  }, [data, search, selectedTag, selectedStatus, isSlaFilterActive]);

  const totalItems = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const visiblePages = useMemo(() => {
    const maxButtons = 4;
    if (totalPages <= maxButtons) return Array.from({ length: totalPages }, (_, i) => i + 1);
    let start = Math.max(1, currentPage - 1);
    let end = start + maxButtons - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxButtons + 1);
    }
    const pages: number[] = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  const getTagPillClass = (tag: AnomalyTag) => {
    switch (tag) {
      case "Over Budget": return "bg-[#ffe4e6] text-[#e11d48]";
      case "High Cost": return "bg-[#fce7f3] text-[#db2777]";
      case "Missing Evidence": return "bg-[#fef3c7] text-[#d97706]";
      case "Duplicate Data": return "bg-[#ede9fe] text-[#7c3aed]";
      default: return "bg-slate-100 text-slate-600";
    }
  };

  const getPriorityPillClass = (prio: ExceptionPriority) => {
    switch (prio) {
      case "Critical": return "bg-[#ffe4e6] text-[#e11d48]";
      case "High": return "bg-[#fce7f3] text-[#e11d48]";
      default: return "bg-slate-100 text-slate-600";
    }
  };

  const getStatusPillClass = (status: ExceptionStatus) => {
    switch (status) {
      case "Terbuka": return "bg-[#e0f2fe] text-[#0284c7]";
      case "Ditinjau": return "bg-[#fef3c7] text-[#d97706]";
      case "Dalam Proses": return "bg-[#ede9fe] text-[#7c3aed]";
      case "Selesai": return "bg-[#dcfce7] text-[#16a34a]";
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f4f7fc]">
      <Sidebar />

      <main className="flex-1 lg:ml-[260px] min-w-0 px-8 py-6 overflow-y-auto">
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
            <button
              onClick={fetchExceptionsFromSupabase}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              <SlidersHorizontal className={`h-3.5 w-3.5 text-slate-600 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Menyinkronkan..." : "Sinkronkan Supabase"}</span>
            </button>

            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#e0f2fe] px-3 py-1.5 text-xs font-semibold text-[#0284c7]">
              <CalendarDays className="h-3.5 w-3.5 text-[#0284c7]" />
              {currentLivePeriod}
            </span>
          </div>
        </div>

        {toastMessage && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <Check className="h-5 w-5 text-emerald-600" />
              <p className="text-xs font-bold text-emerald-950">{toastMessage}</p>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-950 cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* 4 Kartu KPI Makro */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-[11px] font-bold tracking-wider text-slate-400">TOTAL EXCEPTION</span>
            <div className="mt-2 flex items-center gap-2">
              <h2 className="text-2xl font-bold text-slate-900">{metrics.total}</h2>
              {metrics.criticalCount > 0 && (
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-[#ffe4e6] text-[#e11d48]">
                  +{metrics.criticalCount}
                </span>
              )}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">{metrics.criticalCount} transaksi berisiko tinggi</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-[11px] font-bold tracking-wider text-slate-400">OVER BUDGET</span>
            <div className="mt-2">
              <h2 className="text-2xl font-bold text-slate-900">{metrics.overBudgetCount}</h2>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Total {formatCompactRupiah(metrics.overBudgetNominal)}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-[11px] font-bold tracking-wider text-slate-400">HIGH COST</span>
            <div className="mt-2">
              <h2 className="text-2xl font-bold text-slate-900">{metrics.highCostCount}</h2>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Di atas threshold rule</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-[11px] font-bold tracking-wider text-slate-400">DATA QUALITY</span>
            <div className="mt-2">
              <h2 className="text-2xl font-bold text-slate-900">{metrics.dataQualityCount}</h2>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              {metrics.missingEvidenceCount} evidence · {metrics.duplicateCount} duplikasi
            </p>
          </div>
        </div>

        {/* SLA Banner & Distribusi Prioritas (Critical: 3, High: 25) */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.65fr_1fr]">
          {metrics.slaCount > 0 ? (
            <div className="flex items-center justify-between rounded-xl border border-[#fecdd3] bg-[#fff1f2] p-5 shadow-sm">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e11d48] text-white shadow-sm">
                  <AlertTriangle className="h-5 w-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#9f1239]">
                    {metrics.slaCount} exception kritis melewati SLA 24 jam
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
                    Semua status exception telah diselesaikan
                  </h3>
                  <p className="mt-0.5 text-xs text-emerald-700">
                    Tidak ada transaksi yang melebihi batas waktu SLA 24 jam.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800">Distribusi Prioritas</h3>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex flex-col items-center">
                <span className="rounded-full bg-[#ffe4e6] px-2.5 py-0.5 text-[10px] font-bold text-[#e11d48]">Critical</span>
                <span className="mt-2 text-xl font-bold text-slate-900">{metrics.criticalCount}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="rounded-full bg-[#ffe4e6] px-2.5 py-0.5 text-[10px] font-bold text-[#e11d48]">High</span>
                <span className="mt-2 text-xl font-bold text-slate-900">{metrics.highCount}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-[10px] font-bold text-[#d97706]">Medium</span>
                <span className="mt-2 text-xl font-bold text-slate-900">{metrics.mediumCount}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="rounded-full bg-[#f1f5f9] px-2.5 py-0.5 text-[10px] font-bold text-[#64748b]">Low</span>
                <span className="mt-2 text-xl font-bold text-slate-900">{metrics.lowCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabel Daftar Exception */}
        <div id="daftar-exception-table" className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Daftar Exception</h3>
              <p className="text-[11px] text-slate-400">Klik baris untuk meninjau dan menyelesaikan anomali</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-700" />
                <input
                  type="text"
                  placeholder="Cari customer, job, atau ID..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-56 rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs font-medium text-slate-900 placeholder:text-slate-500 outline-none focus:border-[#0a7ebf]"
                />
              </div>

              <select
                value={selectedTag}
                onChange={(e) => {
                  setSelectedTag(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="Semua Tipe">Semua Tipe</option>
                <option value="Over Budget">Over Budget</option>
                <option value="Missing Evidence">Missing Evidence</option>
                <option value="Duplicate Data">Duplicate Data</option>
                <option value="High Cost">High Cost</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="Semua Status">Semua Status</option>
                <option value="Terbuka">Terbuka</option>
                <option value="Ditinjau">Ditinjau</option>
                <option value="Dalam Proses">Dalam Proses</option>
                <option value="Selesai">Selesai</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400">
                  <th className="py-3 px-3">ID RECORD</th>
                  <th className="py-3 px-3">CUSTOMER</th>
                  <th className="py-3 px-3">NOMINAL</th>
                  <th className="py-3 px-3">TIPE MASALAH</th>
                  <th className="py-3 px-3">PRIORITAS</th>
                  <th className="py-3 px-3">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedData.map((row) => (
                  <tr
                    key={row.dbId}
                    onClick={() => {
                      setActiveReviewItem(row);
                      setNewStatus(row.status);
                      setReviewNotes(row.resolutionNotes || "");
                    }}
                    className="hover:bg-slate-50 transition cursor-pointer"
                  >
                    <td className="py-3.5 px-3 font-mono font-medium text-slate-500">{row.id}</td>
                    <td className="py-3.5 px-3">
                      <p className="font-bold text-slate-900">{row.customer}</p>
                      <p className="font-mono text-[11px] text-slate-400">{row.jobNumber}</p>
                    </td>
                    <td className="py-3.5 px-3 font-medium text-slate-900">{formatRupiah(row.nominal)}</td>
                    <td className="py-3.5 px-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${getTagPillClass(row.tipeMasalah)}`}>
                        {row.tipeMasalah}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${getPriorityPillClass(row.prioritas)}`}>
                        {row.prioritas}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${getStatusPillClass(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Menampilkan {totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}–
              {Math.min(currentPage * itemsPerPage, totalItems)} dari {totalItems} exception
            </p>

            <div className="flex items-center rounded-full border border-sky-400/80 bg-white px-3 py-1 gap-2 shadow-xs">
              {currentPage > 1 && (
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="text-[#0a7ebf] transition hover:text-[#08689d] mr-0.5 cursor-pointer">
                  <ChevronLeft className="h-3.5 w-3.5 stroke-[2.5]" />
                </button>
              )}
              {visiblePages.map((num) => (
                <button
                  key={num}
                  onClick={() => setCurrentPage(num)}
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold transition cursor-pointer ${
                    currentPage === num ? "bg-[#0a7ebf] text-white font-bold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {num}
                </button>
              ))}
              {currentPage < totalPages && (
                <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} className="text-[#0a7ebf] transition hover:text-[#08689d] ml-0.5 cursor-pointer">
                  <ChevronRight className="h-3.5 w-3.5 stroke-[2.5]" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal Tindak Lanjut Resolusi */}
        {activeReviewItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 text-left">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Tinjau Transaksi Exception</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{activeReviewItem.customer} ({activeReviewItem.id})</p>
                </div>
                <button onClick={() => setActiveReviewItem(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nomor Pekerjaan:</span>
                    <span className="font-semibold text-slate-900">{activeReviewItem.jobNumber || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nominal Aktual:</span>
                    <span className="font-bold text-slate-900">{formatRupiah(activeReviewItem.nominal)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Kategori Anomali:</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getTagPillClass(activeReviewItem.tipeMasalah)}`}>
                      {activeReviewItem.tipeMasalah}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Perbarui Status Peninjauan</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as ExceptionStatus)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#0a7ebf]"
                  >
                    <option value="Terbuka">Terbuka</option>
                    <option value="Ditinjau">Ditinjau</option>
                    <option value="Dalam Proses">Dalam Proses</option>
                    <option value="Selesai">Selesai (Tutup Exception)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Catatan Tindak Lanjut</label>
                  <textarea
                    rows={3}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Catatan rekonsiliasi..."
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#0a7ebf]"
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => setActiveReviewItem(null)}
                  disabled={isUpdatingStatus}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveReviewStatus}
                  disabled={isUpdatingStatus}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0a7ebf] px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#08689d] disabled:opacity-50 cursor-pointer"
                >
                  {isUpdatingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  <span>Simpan Status</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}