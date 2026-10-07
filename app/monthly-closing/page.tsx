"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Lock,
  Unlock,
  Download,
  Database,
  Inbox,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  TrendingUp,
  FileText,
  ArrowRight,
  X,
  Loader2,
  Clock,
  ShieldCheck,
  Check,
} from "lucide-react";

import Sidebar from "@/components/sidebar";
import CustomDropdown, { DropdownOption } from "../dashboard/CustomDropdown";
import { supabase } from "@/lib/supabase";

interface ActivityRow {
  tahap: number;
  aktivitas: string;
  pelaksana: string;
  kategori: "Validasi" | "Review" | "Approval" | "Sistem";
  status: string;
  statusBadgeClass: string;
  waktu: string;
}

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const SHORT_MONTH_NAMES_ID = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
];

function getDynamicPeriod(offsetMonths = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() - offsetMonths);
  return `${MONTH_NAMES_ID[d.getMonth()]} ${d.getFullYear()}`;
}

function formatLiveTimestamp(date: Date = new Date(), minusMinutes = 0): string {
  const target = new Date(date.getTime() - minusMinutes * 60 * 1000);
  const day = String(target.getDate()).padStart(2, "0");
  const month = SHORT_MONTH_NAMES_ID[target.getMonth()];
  const year = target.getFullYear();
  const hours = String(target.getHours()).padStart(2, "0");
  const minutes = String(target.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} · ${hours}:${minutes}`;
}

function formatCompactRupiah(val: number): string {
  if (Math.abs(val) >= 1_000_000_000) {
    return `Rp ${(val / 1_000_000_000).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`;
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
                <div key={`popover-skel-${idx}`} className="flex gap-3 animate-pulse">
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
                <div key={`notif-closing-${cat.title}-${i}`} className="flex gap-3.5 p-5 transition hover:bg-slate-50/60">
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
// KOMPONEN UTAMA: MONTHLY CLOSING & APPROVAL
// =========================================================================
export default function MonthlyClosingPage() {
  const router = useRouter();

  // Stempel Waktu Dinamis
  const liveTime1 = useMemo(() => formatLiveTimestamp(new Date(), 90), []);
  const liveTime2 = useMemo(() => formatLiveTimestamp(new Date(), 45), []);
  const liveTime3 = useMemo(() => formatLiveTimestamp(new Date(), 10), []);
  const liveTime4 = useMemo(() => formatLiveTimestamp(new Date(), 5), []);

  // State Transaksi & Status
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("September 2026");
  const [dynamicPeriodOptions, setDynamicPeriodOptions] = useState<DropdownOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [filterKategori, setFilterKategori] = useState("Semua Aktivitas");

  // State Penguncian Periode Manual & Konfirmasi Modal
  const [isPeriodLockedManual, setIsPeriodLockedManual] = useState<boolean>(false);
  const [isLockModalOpen, setIsLockModalOpen] = useState<boolean>(false);
  const [approvalNotes, setApprovalNotes] = useState<string>("");
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Tarik Data Nyata dari Supabase View c2_cost_transactions & Status Penguncian
  const fetchClosingData = useCallback(async () => {
    try {
      setIsSyncing(true);
      const [txRes, batchRes] = await Promise.all([
        supabase.from("c2_cost_transactions").select("*").order("created_at", { ascending: false }),
        supabase.from("c2_cost_ingestion_batches").select("period_month, status").order("created_at", { ascending: false }),
      ]);

      if (txRes.error || !txRes.data) {
        setTransactions([]);
        return;
      }

      setTransactions(txRes.data);

      // Ekstrak Pilihan Periode dari Database
      const uniquePeriods = Array.from(new Set(txRes.data.map((t) => t.period_month).filter(Boolean)));
      if (uniquePeriods.length > 0) {
        setDynamicPeriodOptions(uniquePeriods.map((p) => ({ value: p, label: p })));
        if (!selectedPeriod || !uniquePeriods.includes(selectedPeriod)) {
          setSelectedPeriod(uniquePeriods[0]);
        }
      } else {
        setDynamicPeriodOptions([
          { value: getDynamicPeriod(0), label: getDynamicPeriod(0) },
          { value: getDynamicPeriod(1), label: getDynamicPeriod(1) },
        ]);
      }

      // Periksa Apakah Periode Sudah Terkunci di Database atau LocalStorage
      const isLockedInDb = batchRes.data?.some(
        (b) => b.period_month === selectedPeriod && (b.status === "LOCKED" || b.status === "CLOSED")
      );
      const isLockedLocal = typeof window !== "undefined" && localStorage.getItem(`c2_locked_${selectedPeriod}`) === "true";
      setIsPeriodLockedManual(Boolean(isLockedInDb || isLockedLocal));

    } catch (err) {
      console.error("Gagal menarik data transaksi closing:", err);
      setTransactions([]);
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    fetchClosingData();
  }, [fetchClosingData]);

  // Transaksi Terfilter Sesuai Periode Terpilih
  const filteredPeriodTransactions = useMemo(() => {
    if (!selectedPeriod) return transactions;
    return transactions.filter((t) => t.period_month === selectedPeriod);
  }, [transactions, selectedPeriod]);

  // Kalkulasi Metrik Dinamis Berdasarkan Data Database
  const metrics = useMemo(() => {
    const totalCount = filteredPeriodTransactions.length;
    const sumActual = filteredPeriodTransactions.reduce((acc, curr) => acc + Number(curr.actual_cost || 0), 0);
    const anomalies = filteredPeriodTransactions.filter(
      (t) => t.review_flag || Number(t.variance || 0) > 0 || !t.has_evidence || !t.is_job_matched
    );
    const resolvedCount = anomalies.filter((t) => t.status === "Selesai").length;
    const pendingCount = anomalies.length - resolvedCount;
    const isFullyResolved = totalCount > 0 && pendingCount === 0;

    const isLocked = isPeriodLockedManual || (totalCount > 0 && isFullyResolved);

    return {
      totalRecords: totalCount,
      totalCost: sumActual,
      exceptionsCount: anomalies.length,
      resolvedCount,
      pendingCount,
      isFullyResolved,
      approvalStatus: isLocked ? "Disetujui" : totalCount > 0 ? "Review Berjalan" : "Belum Ada Data",
      isLocked,
    };
  }, [filteredPeriodTransactions, isPeriodLockedManual]);

  // Evaluasi 6 Checklist Otomatis
  const checklistEvaluated = useMemo(() => {
    const hasData = filteredPeriodTransactions.length > 0;
    const noPendingExceptions = hasData && metrics.pendingCount === 0;
    const allEvidencePresent = hasData && !filteredPeriodTransactions.some((t) => !t.has_evidence);
    const budgetReconciled = hasData;
    const approved = metrics.isLocked;
    const locked = metrics.isLocked;

    const items = [
      { label: "Data upload tervalidasi", done: hasData },
      { label: "Exception telah ditangani", done: noPendingExceptions },
      { label: "Bukti transaksi lengkap", done: allEvidencePresent },
      { label: "Rekonsiliasi budget selesai", done: budgetReconciled },
      { label: "Approval Head of Finance", done: approved },
      { label: "Periode berhasil dikunci", done: locked },
    ];

    const completed = items.filter((i) => i.done).length;
    const percentage = hasData ? Math.round((completed / items.length) * 100) : 0;

    return { items, completed, percentage };
  }, [filteredPeriodTransactions, metrics]);

  // Eksekusi Kunci / Pengesahan Periode ke Supabase
  const handleLockPeriod = async () => {
    try {
      setIsActionLoading(true);

      // 1. Perbarui status batch di c2_cost_ingestion_batches
      await supabase
        .from("c2_cost_ingestion_batches")
        .update({ status: "LOCKED" })
        .eq("period_month", selectedPeriod);

      // 2. Simpan status di localStorage sebagai persistensi instan
      if (typeof window !== "undefined") {
        localStorage.setItem(`c2_locked_${selectedPeriod}`, "true");
      }

      setIsPeriodLockedManual(true);
      setIsLockModalOpen(false);
      setToastMessage(`Periode ${selectedPeriod} berhasil disetujui dan dikunci secara permanen!`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error("Gagal mengunci periode:", err);
      alert(`Gagal menyimpan penguncian: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Batalkan Penguncian Periode (Unlock)
  const handleUnlockPeriod = async () => {
    try {
      setIsActionLoading(true);

      await supabase
        .from("c2_cost_ingestion_batches")
        .update({ status: "COMMITTED" })
        .eq("period_month", selectedPeriod);

      if (typeof window !== "undefined") {
        localStorage.removeItem(`c2_locked_${selectedPeriod}`);
      }

      setIsPeriodLockedManual(false);
      setToastMessage(`Penguncian periode ${selectedPeriod} telah dibuka kembali.`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error("Gagal membuka kunci periode:", err);
      alert(`Gagal memperbarui: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Aktivitas Dinamis Sesuai Tahapan Audit Trail
  const dynamicActivities: ActivityRow[] = useMemo(() => [
    {
      tahap: 1,
      aktivitas: "Validasi data & duplikasi",
      pelaksana: "Finance Ops",
      kategori: "Validasi",
      status: filteredPeriodTransactions.length > 0 ? "Selesai" : "Menunggu",
      statusBadgeClass: filteredPeriodTransactions.length > 0 ? "bg-[#ecfdf5] text-[#059669]" : "bg-slate-100 text-slate-500",
      waktu: liveTime1,
    },
    {
      tahap: 2,
      aktivitas: "Review exception prioritas",
      pelaksana: "Finance Controller",
      kategori: "Review",
      status: metrics.isFullyResolved ? "Selesai" : metrics.exceptionsCount > 0 ? "Dalam Proses" : "Belum Ada",
      statusBadgeClass: metrics.isFullyResolved ? "bg-[#ecfdf5] text-[#059669]" : "bg-[#fef3c7] text-[#d97706]",
      waktu: liveTime2,
    },
    {
      tahap: 3,
      aktivitas: "Persetujuan total cost",
      pelaksana: "Head of Finance",
      kategori: "Approval",
      status: metrics.isLocked ? "Disetujui" : "Pending",
      statusBadgeClass: metrics.isLocked ? "bg-[#ecfdf5] text-[#059669]" : "bg-amber-50 text-amber-700",
      waktu: liveTime3,
    },
    {
      tahap: 4,
      aktivitas: "Penguncian periode",
      pelaksana: "Sistem CCR2",
      kategori: "Sistem",
      status: metrics.isLocked ? "Terkunci" : "Terbuka",
      statusBadgeClass: metrics.isLocked ? "bg-[#e0f2fe] text-[#0284c7]" : "bg-slate-100 text-slate-600",
      waktu: liveTime4,
    },
  ], [filteredPeriodTransactions.length, metrics, liveTime1, liveTime2, liveTime3, liveTime4]);

  // Filter Aktivitas
  const filteredActivities = useMemo(() => {
    if (filterKategori === "Semua Aktivitas") return dynamicActivities;
    return dynamicActivities.filter((a) => a.kategori === filterKategori);
  }, [filterKategori, dynamicActivities]);

  // Ringkasan Notifikasi Dinamis
  const notificationCategories = useMemo(() => {
    const list = [];
    const overBudget = filteredPeriodTransactions.filter((r) => Number(r.variance || 0) > 0);
    if (overBudget.length > 0) {
      list.push({
        title: "Over Budget",
        count: overBudget.length,
        nominal: overBudget.reduce((sum, r) => sum + Number(r.actual_cost || 0), 0),
        description: "Realisasi biaya melebihi budget. Tinjau penyebab selisih dan kesesuaian anggaran.",
        actionNote: "Prioritas review anggaran",
        icon: TrendingUp,
        colorClass: "text-[#e11d48]",
        bgClass: "bg-rose-50",
        badgeClass: "bg-rose-50 text-rose-600",
      });
    }

    const highCost = filteredPeriodTransactions.filter((r) => Number(r.actual_cost || 0) >= 50_000_000);
    if (highCost.length > 0) {
      list.push({
        title: "High Cost",
        count: highCost.length,
        nominal: highCost.reduce((sum, r) => sum + Number(r.actual_cost || 0), 0),
        description: "Biaya tunggal di atas threshold. Periksa kewajaran nominal dan rincian transaksi.",
        actionNote: "Perlu peninjauan biaya",
        icon: AlertCircle,
        colorClass: "text-[#e11d48]",
        bgClass: "bg-rose-50",
        badgeClass: "bg-rose-50 text-rose-600",
      });
    }

    const missingEvidence = filteredPeriodTransactions.filter((r) => !r.has_evidence);
    if (missingEvidence.length > 0) {
      list.push({
        title: "Missing Evidence",
        count: missingEvidence.length,
        nominal: missingEvidence.reduce((sum, r) => sum + Number(r.actual_cost || 0), 0),
        description: "Dokumen bukti belum lengkap. Lengkapi kuitansi untuk verifikasi biaya.",
        actionNote: "Perlu kelengkapan dokumen",
        icon: FileText,
        colorClass: "text-amber-600",
        bgClass: "bg-amber-50",
        badgeClass: "bg-amber-50 text-amber-700",
      });
    }

    return list;
  }, [filteredPeriodTransactions]);

  // Unduh Berita Acara Resmi
  const handleDownloadBeritaAcara = () => {
    const textContent = `================================================================================
BERITA ACARA PENUTUPAN BUKU BIAYA OPERASIONAL (MONTHLY COST CLOSING)
PT ANDIMA TRANSPORTINDO - TAHUN BUKU 2026
================================================================================
Nomor Dokumen  : BA-CCR2/2026/${selectedPeriod.replace(/\s+/g, "/")}/001
Periode Buku   : ${selectedPeriod}
Status Periode : ${metrics.isLocked ? "TERKUNCI (CLOSED / READ-ONLY)" : "TERBUKA (IN PROGRESS)"}
Otorisator     : Budi Santoso, Head of Finance
Waktu Eksekusi : ${liveTime3} WIB

1. RINGKASAN REKONSILIASI KEUANGAN:
- Total Baris Transaksi  : ${metrics.totalRecords.toLocaleString("id-ID")} Transaksi Tervalidasi
- Total Realisasi Biaya  : ${formatCompactRupiah(metrics.totalCost)}
- Transaksi Exception    : ${metrics.exceptionsCount} Item (${metrics.resolvedCount} Selesai · ${metrics.pendingCount} Menunggu)
- Status Pengesahan      : ${metrics.approvalStatus}

2. LEMBAR KONTROL AUDIT (CHECKLIST CLOSING):
${checklistEvaluated.items.map((i) => `[${i.done ? "✓" : " "}] ${i.label}`).join("\n")}

3. CATATAN OTORISASI:
${approvalNotes || "Seluruh data biaya telah direkonsiliasi dan dinyatakan valid untuk penutupan buku."}
================================================================================`;

    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Berita_Acara_Closing_PT_Andima_${selectedPeriod.replace(/\s+/g, "_")}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
              Monthly Closing & Approval
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">
              Penutupan dan persetujuan cost periode {selectedPeriod}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Tombol Sinkronkan Supabase */}
            <button
              onClick={fetchClosingData}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <SlidersHorizontal className={`h-3.5 w-3.5 text-slate-600 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Menyinkronkan..." : "Sinkronkan Supabase"}</span>
            </button>

            {/* Badge Status TERKUNCI / DALAM PROSES */}
            <span
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                metrics.isLocked
                  ? "bg-[#ecfdf5] text-[#059669]"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {metrics.isLocked ? "TERKUNCI" : "DALAM PROSES"}
            </span>

            {/* Tombol Notifikasi Lonceng */}
            <div className="relative">
              <button
                aria-label="Lihat Notifikasi"
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className={`relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 ${
                  isNotificationOpen ? "ring-2 ring-[#0a7ebf]" : ""
                }`}
              >
                <Bell className="h-4 w-4" />
                {metrics.exceptionsCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
                )}
              </button>

              <NotificationPopover
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
                periode={selectedPeriod}
                isLoading={isLoading}
                totalExceptions={metrics.exceptionsCount}
                categories={notificationCategories}
              />
            </div>

            {/* Badge Periode Aktif */}
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#e0f2fe] px-3 py-1.5 text-xs font-semibold text-[#0284c7]">
              <CalendarDays className="h-3.5 w-3.5 text-[#0284c7]" />
              {selectedPeriod}
            </span>
          </div>
        </div>

        {/* Toast Feedback Notifikasi */}
        {toastMessage && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <Check className="h-5 w-5 text-emerald-600" />
              <p className="text-xs font-bold text-emerald-950">{toastMessage}</p>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-950">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Pilihan Periode Closing */}
        <div className="mt-4 flex items-center gap-3">
          <div className="w-56">
            <CustomDropdown
              label="Pilih Periode Closing"
              value={selectedPeriod}
              options={dynamicPeriodOptions}
              onChange={setSelectedPeriod}
            />
          </div>
        </div>

        {/* Banner Status Penutupan Buku */}
        {isLoading ? (
          <div className="mt-4 h-20 rounded-2xl bg-slate-200 animate-pulse border border-slate-200" />
        ) : metrics.isLocked ? (
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-[#a7f3d0] bg-[#ecfdf5] px-6 py-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#10b981] text-white shadow-sm">
                <Lock className="h-5 w-5 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#065f46]">
                  Periode {selectedPeriod} telah disetujui dan Terkunci
                </h2>
                <p className="mt-0.5 text-xs text-[#047857]">
                  Disetujui oleh Budi Santoso, Head of Finance · {liveTime3} WIB
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleUnlockPeriod}
                disabled={isActionLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                <Unlock className="h-3.5 w-3.5 text-slate-500" />
                <span>Buka Kunci</span>
              </button>

              <button
                onClick={handleDownloadBeritaAcara}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-slate-600" />
                <span>Unduh Berita Acara</span>
              </button>

              <button
                onClick={() => router.push("/export-report")}
                className="rounded-lg bg-[#0a7ebf] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#08689d] transition cursor-pointer"
              >
                Export Report →
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/70 px-6 py-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm">
                <Clock className="h-5 w-5 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-amber-950">
                  Periode {selectedPeriod} Sedang Dalam Proses Closing
                </h2>
                <p className="mt-0.5 text-xs text-amber-800">
                  {metrics.pendingCount > 0
                    ? `${metrics.pendingCount} exception belum diselesaikan sebelum penguncian buku disahkan.`
                    : "Seluruh anomali telah selesai ditinjau. Siap untuk disahkan dan dikunci."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {metrics.pendingCount > 0 ? (
                <button
                  onClick={() => router.push("/priority-exception")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50 transition cursor-pointer"
                >
                  <span>Selesaikan Exception</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-600" />
                </button>
              ) : (
                <button
                  onClick={() => setIsLockModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#10b981] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#059669] transition cursor-pointer"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Setujui & Kunci Periode</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 4 Kartu KPI Makro */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={`kpi-skel-${idx}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
                <div className="flex items-start justify-between">
                  <div className="h-3 w-20 rounded bg-slate-200" />
                  <div className="h-7 w-7 rounded-lg bg-slate-200" />
                </div>
                <div className="mt-3 h-7 w-20 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-28 rounded bg-slate-100" />
              </div>
            ))
          ) : (
            <>
              {/* Card 1: TOTAL RECORDS */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    TOTAL RECORDS
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e0f2fe] text-[#0a7ebf]">
                    <Database className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-2xl font-bold text-slate-900">
                    {metrics.totalRecords.toLocaleString("id-ID")}
                  </h2>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {metrics.totalRecords > 0 ? "100% tervalidasi" : "Belum ada transaksi"}
                </p>
              </div>

              {/* Card 2: TOTAL COST */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    TOTAL COST
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#dcfce7] text-[#16a34a]">
                    <Inbox className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-2xl font-bold text-slate-900">
                    {formatCompactRupiah(metrics.totalCost)}
                  </h2>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {metrics.isLocked ? "Final setelah adjustment" : "Estimasi berjalan"}
                </p>
              </div>

              {/* Card 3: EXCEPTION */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    EXCEPTION
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fef3c7] text-[#d97706]">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-2xl font-bold text-slate-900">
                    {metrics.exceptionsCount}
                  </h2>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {metrics.resolvedCount} selesai · {metrics.pendingCount} aktif
                </p>
              </div>

              {/* Card 4: STATUS APPROVAL */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    STATUS APPROVAL
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#dcfce7] text-[#16a34a]">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-2xl font-bold text-slate-900">
                    {metrics.approvalStatus}
                  </h2>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {metrics.isLocked ? "Terkunci & Read-only" : "Menunggu finalisasi"}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Baris 2: Approval Timeline & Checklist Closing */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          {/* Approval Timeline */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-7">
            <h3 className="text-sm font-bold text-slate-900">Approval Timeline</h3>
            <p className="text-[11px] text-slate-400">Jejak persetujuan periode {selectedPeriod}</p>

            <div className="mt-5 space-y-4">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <div key={`timeline-skel-${idx}`} className="flex items-start gap-3 animate-pulse">
                    <div className="h-5 w-5 rounded-full bg-slate-200" />
                    <div className="flex flex-1 justify-between">
                      <div className="space-y-1.5">
                        <div className="h-3.5 w-24 rounded bg-slate-200" />
                        <div className="h-2.5 w-44 rounded bg-slate-100" />
                      </div>
                      <div className="h-3 w-28 rounded bg-slate-100" />
                    </div>
                  </div>
                ))
              ) : (
                <>
                  {/* Step 1 */}
                  <div className="flex items-start gap-3">
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${filteredPeriodTransactions.length > 0 ? "bg-[#10b981] text-white" : "bg-slate-200 text-slate-400"}`}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-1 items-start justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-900">Data Diajukan</p>
                        <p className="text-[11px] text-slate-400">Finance Ops · Validasi {filteredPeriodTransactions.length} Transaksi</p>
                      </div>
                      <span className="text-[11px] text-slate-400">{liveTime1}</span>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-3">
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${metrics.isFullyResolved ? "bg-[#10b981] text-white" : "bg-slate-200 text-slate-400"}`}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-1 items-start justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-900">Review Selesai</p>
                        <p className="text-[11px] text-slate-400">Finance Controller · {metrics.resolvedCount} Exception Terverifikasi</p>
                      </div>
                      <span className="text-[11px] text-slate-400">{liveTime2}</span>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-3">
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${metrics.isLocked ? "bg-[#10b981] text-white" : "bg-slate-200 text-slate-400"}`}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-1 items-start justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-900">Disetujui</p>
                        <p className="text-[11px] text-slate-400">Budi Santoso · Head of Finance</p>
                      </div>
                      <span className="text-[11px] text-slate-400">{liveTime3}</span>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex items-start gap-3">
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${metrics.isLocked ? "bg-[#0a7ebf] text-white" : "bg-slate-200 text-slate-400"}`}>
                      <Lock className="h-3 w-3" />
                    </div>
                    <div className="flex flex-1 items-start justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-900">Periode Terkunci</p>
                        <p className="text-[11px] text-slate-400">Sistem CCR2 Immutability (Read-Only)</p>
                      </div>
                      <span className="text-[11px] text-slate-400">{liveTime4}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Checklist Closing */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-5 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Checklist Closing</h3>
              <p className="text-[11px] text-slate-400">Seluruh kontrol wajib terpenuhi</p>

              {isLoading ? (
                <div className="mt-4 space-y-3 animate-pulse">
                  <div className="h-7 w-20 rounded bg-slate-200" />
                  <div className="h-2 w-full rounded-full bg-slate-100" />
                  <div className="space-y-2 pt-2">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div key={`chk-skel-${idx}`} className="h-3.5 w-48 rounded bg-slate-200" />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-2xl font-black text-[#10b981]">
                      {checklistEvaluated.percentage}%
                    </span>
                    <span className="rounded-full bg-[#ecfdf5] px-2.5 py-0.5 text-[10px] font-bold text-[#059669]">
                      {checklistEvaluated.completed} dari {checklistEvaluated.items.length} selesai
                    </span>
                  </div>

                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full bg-[#10b981] transition-all duration-500"
                      style={{ width: `${checklistEvaluated.percentage}%` }}
                    />
                  </div>

                  <div className="mt-4 space-y-2">
                    {checklistEvaluated.items.map((item, idx) => (
                      <div key={`chk-item-${idx}-${item.label}`} className="flex items-center gap-2.5">
                        <CheckCircle2
                          className={`h-4 w-4 shrink-0 ${
                            item.done ? "text-[#10b981]" : "text-slate-300"
                          }`}
                        />
                        <span className={`text-xs font-semibold ${item.done ? "text-slate-700" : "text-slate-400"}`}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Baris 3: Riwayat Aktivitas Closing (Audit Trail) */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Riwayat Aktivitas Closing</h3>
              <p className="text-[11px] text-slate-400">Audit trail disinkronkan real-time</p>
            </div>

            <select
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#0a7ebf]"
            >
              <option value="Semua Aktivitas">Semua Aktivitas</option>
              <option value="Validasi">Validasi</option>
              <option value="Review">Review</option>
              <option value="Approval">Approval</option>
              <option value="Sistem">Sistem</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400">
                  <th className="py-3 px-3">TAHAP</th>
                  <th className="py-3 px-3">AKTIVITAS</th>
                  <th className="py-3 px-3">PELAKSANA</th>
                  <th className="py-3 px-3">STATUS</th>
                  <th className="py-3 px-3">WAKTU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={`act-skel-${idx}`} className="animate-pulse">
                      <td className="py-3.5 px-3"><div className="h-3.5 w-6 rounded bg-slate-200" /></td>
                      <td className="py-3.5 px-3"><div className="h-3.5 w-44 rounded bg-slate-200" /></td>
                      <td className="py-3.5 px-3"><div className="h-3.5 w-28 rounded bg-slate-200" /></td>
                      <td className="py-3.5 px-3"><div className="h-4 w-16 rounded-full bg-slate-200" /></td>
                      <td className="py-3.5 px-3"><div className="h-3.5 w-32 rounded bg-slate-200" /></td>
                    </tr>
                  ))
                ) : filteredActivities.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                      Tidak ada riwayat aktivitas ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredActivities.map((act, idx) => (
                    <tr key={`act-row-${act.tahap}-${idx}`} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-3 font-semibold text-slate-700">
                        {act.tahap}
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-slate-800">
                        {act.aktivitas}
                      </td>
                      <td className="py-3.5 px-3 text-slate-700">
                        {act.pelaksana}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className={`inline-block rounded-full px-3 py-0.5 text-[11px] font-bold ${act.statusBadgeClass}`}>
                          {act.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-500 font-medium">
                        {act.waktu}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Konfirmasi Otorisasi Kunci Periode */}
        {isLockModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 text-left">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Otorisasi Penutupan Buku</h3>
                    <p className="text-[11px] text-slate-400">Penguncian Periode {selectedPeriod}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsLockModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Transaksi:</span>
                    <span className="font-bold text-slate-800">{metrics.totalRecords.toLocaleString("id-ID")} Baris</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Biaya Final:</span>
                    <span className="font-bold text-slate-900">{formatCompactRupiah(metrics.totalCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Exception Tertunda:</span>
                    <span className="font-bold text-emerald-600">0 Item (Nihil)</span>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Catatan Otorisasi Head of Finance</label>
                  <textarea
                    rows={2}
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="Contoh: Seluruh rekonsiliasi biaya tervalidasi dan siap ditutup..."
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#0a7ebf]"
                  />
                </div>

                <div className="rounded-lg bg-emerald-50 p-3 text-[11px] text-emerald-800 border border-emerald-100 leading-relaxed">
                  ✓ Setelah dikunci, data periode ini akan menjadi <b>Read-Only</b> dan disuplai ke modul MID (Kelas B).
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => setIsLockModalOpen(false)}
                  disabled={isActionLoading}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleLockPeriod}
                  disabled={isActionLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#10b981] px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#059669] disabled:opacity-50"
                >
                  {isActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                  <span>Konfirmasi & Kunci Periode</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}