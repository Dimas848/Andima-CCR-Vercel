"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Search,
  Flame,
  AlertTriangle,
  Clock,
  Info,
  X,
  CheckCircle2,
  Loader2,
  SlidersHorizontal,
  TrendingUp,
  FileText,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

import sidebar from "@/components/sidebar";
import { supabase } from "@/lib/supabase";

// Alias ke huruf kapital untuk aturan parser sintaks JSX React
const Sidebar = sidebar;

export type PriorityLevel = "Critical" | "High" | "Medium" | "Low";
export type ExceptionStatus = "Terbuka" | "Ditinjau" | "Dalam Proses" | "Selesai";

export interface PriorityExceptionRow {
  id: string;
  dbId: string;
  customer: string;
  jobNumber: string;
  masalah: string;
  nominalRaw: number;
  varianceRaw: number;
  nominal: string;
  variance: string;
  prioritas: PriorityLevel;
  status: ExceptionStatus;
  slaHours: number;
  resolutionNotes?: string;
}

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

function getDynamicPeriod(offsetMonths = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() - offsetMonths);
  return `${MONTH_NAMES_ID[d.getMonth()]} ${d.getFullYear()}`;
}

function formatRupiah(value: number): string {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function formatCompactRupiah(val: number): string {
  if (Math.abs(val) >= 1_000_000_000) {
    return `Rp ${(val / 1_000_000_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`;
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
  isLoading: boolean;
  totalExceptions: number;
  categories: {
    title: string;
    count: number;
    nominal: number;
    description: string;
    actionNote: string;
    icon: typeof TrendingUp;
    colorClass: string;
    bgClass: string;
    badgeClass: string;
  }[];
}

function NotificationPopover({
  isOpen,
  onClose,
  periode,
  isLoading,
  totalExceptions,
  categories,
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
                {totalExceptions} exception perlu tindak lanjut
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
          ) : categories.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Tidak ada notifikasi aktif saat ini.
            </div>
          ) : (
            categories.map((cat, i) => {
              const IconComp = cat.icon;
              return (
                <div key={i} className="flex gap-3.5 p-5 transition hover:bg-slate-50/60">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cat.bgClass} ${cat.colorClass}`}>
                    <IconComp className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-900">{cat.title}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cat.badgeClass}`}>
                        {cat.count} item
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-900">{formatCompactRupiah(cat.nominal)}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      {cat.description}
                    </p>
                    <span className={`mt-2 block text-[11px] font-bold ${cat.colorClass}`}>
                      {cat.actionNote}
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
// KOMPONEN UTAMA: PRIORITY EXCEPTION DASHBOARD
// =========================================================================
export default function PriorityExceptionPage() {
  const router = useRouter();
  const currentLivePeriod = useMemo(() => getDynamicPeriod(0), []);

  const [rows, setRows] = useState<PriorityExceptionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // State Waktu Pembaruan Terakhir
  const [lastUpdatedTime, setLastUpdatedTime] = useState<Date>(() => new Date());
  const [timeAgoText, setTimeAgoText] = useState("Diperbarui baru saja");

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedPrioritas, setSelectedPrioritas] = useState("Semua Prioritas");
  const [selectedStatus, setSelectedStatus] = useState("Semua Status");

  // State Notifikasi & Modal Detail
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<PriorityExceptionRow | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const calculateTimeAgo = () => {
      const diffMs = Date.now() - lastUpdatedTime.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      if (diffMinutes <= 0) {
        setTimeAgoText("Diperbarui baru saja");
      } else if (diffMinutes < 60) {
        setTimeAgoText(`Diperbarui ${diffMinutes} menit lalu`);
      } else {
        const diffHours = Math.floor(diffMinutes / 60);
        setTimeAgoText(`Diperbarui ${diffHours} jam lalu`);
      }
    };

    calculateTimeAgo();
    const interval = setInterval(calculateTimeAgo, 30000);
    return () => clearInterval(interval);
  }, [lastUpdatedTime]);

  // Tarik Data Live dari Supabase
  const fetchPriorityData = useCallback(async () => {
    try {
      setIsSyncing(true);
      const { data, error } = await supabase
        .from("c2_cost_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !data || data.length === 0) {
        setRows([]);
        setLastUpdatedTime(new Date());
        return;
      }

      const anomalyData = data.filter(
        (t) => t.review_flag || t.variance > 0 || !t.has_evidence || !t.is_job_matched
      );

      if (anomalyData.length === 0) {
        setRows([]);
        setLastUpdatedTime(new Date());
        return;
      }

      const transformed: PriorityExceptionRow[] = anomalyData.map((item, idx) => {
        const actual = Number(item.actual_cost || 0);
        const planned = Number(item.planned_cost || 0);
        const variance = Number(item.variance || (actual - planned) || 0);

        let masalah = "Biaya operasional melampaui estimasi";
        let prioritas: PriorityLevel = "Medium";

        if (!item.is_job_matched || item.job_number === "UNMATCHED") {
          masalah = "Nomor pekerjaan tidak terdaftar di sistem CRM";
          prioritas = "Critical";
        } else if (!item.has_evidence) {
          masalah = "Bukti transaksi atau kuitansi belum ada";
          prioritas = "High";
        } else if (actual >= 50000000) {
          masalah = "Biaya tunggal bernilai tinggi di atas threshold";
          prioritas = "High";
        } else if (variance > 0) {
          masalah = "Over budget alokasi biaya pengiriman";
          prioritas = variance > 20000000 ? "Critical" : "High";
        }

        const status: ExceptionStatus = item.review_flag
          ? "Terbuka"
          : (item.status as ExceptionStatus) || "Ditinjau";

        const createdDate = new Date(item.created_at || Date.now()).getTime();
        const diffHours = Math.max(1, Math.floor((Date.now() - createdDate) / (1000 * 60 * 60)));

        const idGenerated = item.code || (item.id ? `EXC-${String(item.id).slice(-4).toUpperCase()}` : `EXC-${String(idx + 1).padStart(4, "0")}`);

        return {
          id: idGenerated,
          dbId: item.id || `db-${idx}`,
          customer: item.customer_name || "Tanpa Nama Customer",
          jobNumber: item.job_number || "-",
          masalah,
          nominalRaw: actual,
          varianceRaw: variance,
          nominal: formatRupiah(actual),
          variance: variance >= 0 ? `+${formatRupiah(variance)}` : formatRupiah(variance),
          prioritas,
          status,
          slaHours: diffHours,
          resolutionNotes: item.description,
        };
      });

      setRows(transformed);
      setLastUpdatedTime(new Date());
    } catch (err) {
      console.error(err);
      setRows([]);
      setLastUpdatedTime(new Date());
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPriorityData();
  }, [fetchPriorityData]);

  // Kalkulasi Metrik KPI Dinamis
  const metrics = useMemo(() => {
    const criticalRows = rows.filter((r) => r.prioritas === "Critical");
    const highRows = rows.filter((r) => r.prioritas === "High");
    const mediumRows = rows.filter((r) => r.prioritas === "Medium");
    const lowRows = rows.filter((r) => r.prioritas === "Low");

    const criticalNominal = criticalRows.reduce((acc, curr) => acc + curr.nominalRaw, 0);
    const highNominal = highRows.reduce((acc, curr) => acc + curr.nominalRaw, 0);
    const mediumNominal = mediumRows.reduce((acc, curr) => acc + curr.nominalRaw, 0);
    const lowNominal = lowRows.reduce((acc, curr) => acc + curr.nominalRaw, 0);

    const total = rows.length;
    const resolvedOnTime = rows.filter((r) => r.slaHours <= 24 || r.status === "Selesai").length;
    const slaPercentage = total > 0 ? Math.round((resolvedOnTime / total) * 100) : 100;

    return {
      total,
      criticalCount: criticalRows.length,
      criticalNominal,
      highCount: highRows.length,
      highNominal,
      mediumCount: mediumRows.length,
      mediumNominal,
      lowCount: lowRows.length,
      lowNominal,
      resolvedOnTime,
      slaPercentage,
    };
  }, [rows]);

  // 3 Baris Teratas untuk "Fokus Hari Ini" berdasarkan risiko & nominal terbesar
  const focusTodayItems = useMemo(() => {
    return [...rows]
      .filter((r) => r.status !== "Selesai")
      .sort((a, b) => {
        const weight: Record<PriorityLevel, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
        if (weight[b.prioritas] !== weight[a.prioritas]) {
          return weight[b.prioritas] - weight[a.prioritas];
        }
        return b.nominalRaw - a.nominalRaw;
      })
      .slice(0, 3);
  }, [rows]);

  // Kategori Notifikasi Dinamis
  const notificationCategories = useMemo(() => {
    const list = [];
    const overBudget = rows.filter((r) => r.varianceRaw > 0);
    if (overBudget.length > 0) {
      list.push({
        title: "Over Budget",
        count: overBudget.length,
        nominal: overBudget.reduce((sum, r) => sum + r.nominalRaw, 0),
        description: "Realisasi biaya melebihi budget. Tinjau penyebab selisih dan kesesuaian anggaran.",
        actionNote: "Prioritas review anggaran",
        icon: TrendingUp,
        colorClass: "text-[#e11d48]",
        bgClass: "bg-rose-50",
        badgeClass: "bg-rose-50 text-rose-600",
      });
    }

    const highCost = rows.filter((r) => r.nominalRaw >= 50000000);
    if (highCost.length > 0) {
      list.push({
        title: "High Cost",
        count: highCost.length,
        nominal: highCost.reduce((sum, r) => sum + r.nominalRaw, 0),
        description: "Biaya tunggal di atas threshold rule. Periksa kewajaran nominal dan detail transaksi.",
        actionNote: "Perlu peninjauan biaya",
        icon: AlertCircle,
        colorClass: "text-[#e11d48]",
        bgClass: "bg-rose-50",
        badgeClass: "bg-rose-50 text-rose-600",
      });
    }

    const missingEvidence = rows.filter((r) => r.masalah.toLowerCase().includes("bukti"));
    if (missingEvidence.length > 0) {
      list.push({
        title: "Missing Evidence",
        count: missingEvidence.length,
        nominal: missingEvidence.reduce((sum, r) => sum + r.nominalRaw, 0),
        description: "Dokumen bukti belum lengkap. Lengkapi kuitansi yang valid untuk verifikasi biaya.",
        actionNote: "Perlu kelengkapan dokumen",
        icon: FileText,
        colorClass: "text-amber-600",
        bgClass: "bg-amber-50",
        badgeClass: "bg-amber-50 text-amber-700",
      });
    }

    return list;
  }, [rows]);

  // Filter Bar
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchSearch =
        r.customer.toLowerCase().includes(search.toLowerCase()) ||
        r.masalah.toLowerCase().includes(search.toLowerCase()) ||
        r.id.toLowerCase().includes(search.toLowerCase());

      const matchPrioritas =
        selectedPrioritas === "Semua Prioritas" || r.prioritas === selectedPrioritas;
      const matchStatus =
        selectedStatus === "Semua Status" || r.status === selectedStatus;

      return matchSearch && matchPrioritas && matchStatus;
    });
  }, [rows, search, selectedPrioritas, selectedStatus]);

  const displayedTableRows = useMemo(() => {
    return filteredRows.slice(0, 6);
  }, [filteredRows]);

  // Update Status ke Supabase
  const handleUpdateStatus = async (newStatus: ExceptionStatus) => {
    if (!activeItem) return;

    try {
      setIsSubmitting(true);
      const isResolved = newStatus === "Selesai";

      if (activeItem.dbId && !activeItem.dbId.startsWith("db-")) {
        const { error } = await supabase
          .from("cost_actual_transactions")
          .update({
            review_flag: !isResolved,
            description: notes || `Telah ditinjau dengan status ${newStatus}`,
          })
          .eq("id", activeItem.dbId);

        if (error) throw error;
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === activeItem.id
            ? { ...r, status: newStatus, resolutionNotes: notes || r.resolutionNotes }
            : r
        )
      );

      setLastUpdatedTime(new Date());
      showToast(`Status ${activeItem.customer} berhasil diperbarui ke "${newStatus}".`);
      setActiveItem(null);
      setNotes("");
    } catch (err: any) {
      console.error("Gagal update status:", err);
      showToast(`Gagal menyimpan ke database: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityPillClass = (prio: PriorityLevel) => {
    switch (prio) {
      case "Critical":
      case "High":
        return "bg-[#ffe4e6] text-[#e11d48]";
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

      {/* Konten Utama: Ditambahkan ml-64 min-w-0 agar tidak tertimpa sidebar fixed */}
      <main className="flex-1 ml-64 min-w-0 px-8 py-6 overflow-y-auto">
        {/* Header Modul */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Priority Exception Dashboard
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">
              Prioritas penyelesaian exception berdasarkan dampak finansial dan SLA
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Tombol Sinkronkan Supabase */}
            <button
              onClick={fetchPriorityData}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <SlidersHorizontal className={`h-3.5 w-3.5 text-slate-600 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Menyinkronkan..." : "Sinkronkan Supabase"}</span>
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
                isLoading={isLoading}
                totalExceptions={metrics.total}
                categories={notificationCategories}
              />
            </div>

            {/* Badge Periode Aktif Real-Time */}
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#e0f2fe] px-3 py-1.5 text-xs font-semibold text-[#0284c7]">
              <CalendarDays className="h-3.5 w-3.5 text-[#0284c7]" />
              {currentLivePeriod}
            </span>
          </div>
        </div>

        {/* Toast Notifikasi Feedback */}
        {toastMessage && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-semibold text-emerald-900">{toastMessage}</p>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-950">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* 4 Kartu KPI Makro (dengan Skeleton) */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
                <div className="flex items-start justify-between">
                  <div className="h-3 w-20 rounded bg-slate-200" />
                  <div className="h-7 w-7 rounded-lg bg-slate-200" />
                </div>
                <div className="mt-3 h-7 w-14 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-36 rounded bg-slate-100" />
              </div>
            ))
          ) : (
            <>
              {/* CRITICAL */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    CRITICAL
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ffe4e6] text-[#e11d48]">
                    <Flame className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-2xl font-bold text-slate-900">{metrics.criticalCount}</h2>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {formatCompactRupiah(metrics.criticalNominal)} · SLA terlewat
                </p>
              </div>

              {/* HIGH */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    HIGH
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ffe4e6] text-[#e11d48]">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-2xl font-bold text-slate-900">{metrics.highCount}</h2>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {formatCompactRupiah(metrics.highNominal)} · kurang dari 24 jam
                </p>
              </div>

              {/* MEDIUM */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    MEDIUM
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fef3c7] text-[#d97706]">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-2xl font-bold text-slate-900">{metrics.mediumCount}</h2>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {formatCompactRupiah(metrics.mediumNominal)} · kurang dari 3 hari
                </p>
              </div>

              {/* LOW */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    LOW
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e0f2fe] text-[#0284c7]">
                    <Info className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-2xl font-bold text-slate-900">{metrics.lowCount}</h2>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {formatCompactRupiah(metrics.lowNominal)} · kurang dari 7 hari
                </p>
              </div>
            </>
          )}
        </div>

        {/* Baris Fokus Hari Ini & SLA Penyelesaian (dengan Skeleton) */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
          {/* Kotak Fokus Hari Ini */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Fokus Hari Ini</h3>
            <p className="text-[11px] text-slate-400">Berdasarkan risiko dan umur exception</p>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded bg-slate-200" />
                      <div className="space-y-1.5">
                        <div className="h-3.5 w-24 rounded bg-slate-200" />
                        <div className="h-3 w-16 rounded bg-slate-200" />
                      </div>
                    </div>
                    <div className="h-3.5 w-14 rounded bg-slate-200" />
                  </div>
                ))
              ) : focusTodayItems.length === 0 ? (
                <div className="col-span-3 py-6 text-center text-xs text-slate-400">
                  Tidak ada exception berisiko tinggi yang perlu tindakan segera hari ini.
                </div>
              ) : (
                focusTodayItems.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setActiveItem(item);
                      setNotes(item.resolutionNotes || "");
                    }}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 transition hover:border-[#0a7ebf]/30 hover:bg-white"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl font-black text-slate-300 shrink-0">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{item.customer}</p>
                        <span className={`mt-1 inline-block rounded px-1.5 py-0.2 text-[10px] font-bold ${getPriorityPillClass(item.prioritas)}`}>
                          {item.prioritas} · {item.slaHours} jam
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-800 shrink-0 ml-1">
                      {formatCompactRupiah(item.nominalRaw)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Kotak SLA Penyelesaian */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">SLA Penyelesaian</h3>
              <p className="text-[11px] text-slate-400">{currentLivePeriod}</p>
            </div>

            {isLoading ? (
              <div className="my-2 space-y-2 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-20 rounded bg-slate-200" />
                  <div className="h-5 w-20 rounded-full bg-slate-200" />
                </div>
                <div className="h-3 w-48 rounded bg-slate-100" />
              </div>
            ) : (
              <>
                <div className="my-2 flex items-center gap-3">
                  <span className={`text-4xl font-black ${metrics.slaPercentage >= 90 ? "text-[#10b981]" : "text-amber-500"}`}>
                    {metrics.slaPercentage}%
                  </span>
                  <span className="rounded-full bg-[#ecfdf5] px-2.5 py-0.5 text-[10px] font-bold text-[#059669]">
                    Target 90%
                  </span>
                </div>

                <p className="text-[11px] text-slate-400">
                  {metrics.resolvedOnTime} dari {metrics.total} exception ditangani sesuai SLA.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Tabel Daftar Exception Berdasarkan Prioritas */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {/* Header Tabel & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Daftar Exception Berdasarkan Prioritas
              </h3>
              <p className="text-[11px] text-slate-400">
                Data real-time disinkronkan langsung dari Supabase
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
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-56 rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs font-medium text-slate-900 placeholder:text-slate-700 outline-none focus:border-[#0a7ebf] focus:ring-1 focus:ring-[#0a7ebf]"
                />
              </div>

              {/* Dropdown Filter Prioritas */}
              <select
                value={selectedPrioritas}
                onChange={(e) => setSelectedPrioritas(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#0a7ebf]"
              >
                <option value="Semua Prioritas">Semua Prioritas</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>

              {/* Dropdown Filter Status */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
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

          {/* Isi Tabel */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400">
                  <th className="py-3 px-3">CUSTOMER</th>
                  <th className="py-3 px-3">MASALAH</th>
                  <th className="py-3 px-3">NOMINAL</th>
                  <th className="py-3 px-3">VARIANCE</th>
                  <th className="py-3 px-3">PRIORITAS</th>
                  <th className="py-3 px-3">STATUS</th>
                  <th className="py-3 px-3 text-center">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-3.5 px-3">
                        <div className="h-4 w-32 rounded bg-slate-200" />
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="h-4 w-44 rounded bg-slate-200" />
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="h-4 w-20 rounded bg-slate-200" />
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="h-4 w-16 rounded bg-slate-200" />
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="h-5 w-16 rounded-full bg-slate-200" />
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="h-5 w-16 rounded-full bg-slate-200" />
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <div className="mx-auto h-6 w-20 rounded-lg bg-slate-200" />
                      </td>
                    </tr>
                  ))
                ) : displayedTableRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                      Tidak ada exception yang cocok dengan kriteria filter.
                    </td>
                  </tr>
                ) : (
                  displayedTableRows.map((row) => (
                    <tr key={row.dbId} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-3 font-bold text-slate-800">
                        {row.customer}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600">
                        {row.masalah}
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-slate-900">
                        {row.nominal}
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-[#e11d48]">
                        {row.variance}
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
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => {
                            setActiveItem(row);
                            setNotes(row.resolutionNotes || "");
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                        >
                          Lihat Detail
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Tabel */}
          <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
            {isLoading ? (
              <>
                <div className="h-3 w-32 rounded bg-slate-200 animate-pulse" />
                <div className="h-5 w-28 rounded-full bg-slate-200 animate-pulse" />
              </>
            ) : (
              <>
                <p className="text-xs text-slate-400">
                  {displayedTableRows.length} dari {filteredRows.length} exception
                </p>
                <span className="rounded-full bg-[#ecfdf5] px-3 py-1 text-xs font-semibold text-[#059669] transition-all">
                  {timeAgoText}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Modal Lihat Detail & Tindak Lanjut Resolusi */}
        {activeItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{activeItem.customer}</h3>
                  <p className="text-xs text-slate-400">{activeItem.id} · Job: {activeItem.jobNumber}</p>
                </div>
                <button
                  onClick={() => setActiveItem(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-2.5 rounded-xl bg-slate-50 p-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Keterangan Masalah:</span>
                  <span className="font-semibold text-slate-800">{activeItem.masalah}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nominal Aktual:</span>
                  <span className="font-bold text-slate-900">{activeItem.nominal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Selisih (Variance):</span>
                  <span className="font-bold text-[#e11d48]">{activeItem.variance}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200/60 pt-2">
                  <span className="text-slate-500">Prioritas & SLA:</span>
                  <span className="font-bold text-slate-800">{activeItem.prioritas} · {activeItem.slaHours} Jam</span>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-700">
                  Catatan Justifikasi / Audit Trail
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Masukkan catatan peninjauan..."
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-500 outline-none focus:border-[#0a7ebf] focus:ring-1 focus:ring-[#0a7ebf]"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => setActiveItem(null)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={() => handleUpdateStatus("Ditinjau")}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                >
                  Ditinjau
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={() => handleUpdateStatus("Dalam Proses")}
                  className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 disabled:opacity-60"
                >
                  Dalam Proses
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={() => handleUpdateStatus("Selesai")}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-60"
                >
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  Selesaikan
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}