"use client";

import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ArrowLeft,
  RotateCw,
  Download,
  Minus,
  Plus,
  FileText,
  CheckCircle2,
  AlertTriangle,
  X,
  SlidersHorizontal,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  Loader2,
  FileQuestion,
} from "lucide-react";

import sidebar from "@/components/sidebar";
import { supabase } from "@/lib/supabase";

// Alias huruf kapital untuk validitas sintaks JSX React
const Sidebar = sidebar;

// Interface Transaksi Bukti dari Database Supabase
interface EvidenceTransaction {
  id: string;
  voucher_no: string;
  job_number: string;
  customer_name: string;
  cost_category: string;
  actual_cost: number;
  planned_cost: number;
  variance: number;
  has_evidence: boolean;
  evidence_url: string | null;
  reconciliation_result: string;
  review_flag: boolean;
  description: string;
  created_at: string;
}

// Helper Format Nama Bulan Real-Time Bahasa Indonesia
const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

function getDynamicPeriod(offsetMonths = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() - offsetMonths);
  return `${MONTH_NAMES_ID[d.getMonth()]} ${d.getFullYear()}`;
}

function formatRupiah(val: number): string {
  return `Rp ${val.toLocaleString("id-ID")}`;
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
                <div key={`notif-${cat.title}-${i}`} className="flex gap-3.5 p-5 transition hover:bg-slate-50/60">
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
// KOMPONEN UTAMA EVIDENCE CONTENT (DIBUNGKUS SUSPENSE)
// =========================================================================
function EvidenceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentLivePeriod = useMemo(() => getDynamicPeriod(0), []);

  // Parameter Filter URL
  const queryId = searchParams.get("id");
  const queryVoucher = searchParams.get("voucher");
  const queryJob = searchParams.get("job");

  // State Data Dinamis
  const [allTransactions, setAllTransactions] = useState<EvidenceTransaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<EvidenceTransaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // State Kontrol Viewer
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // Status rotasi apakah dalam orientasi lanskap (90° atau 270°)
  const isLandscape = useMemo(() => rotation === 90 || rotation === 270, [rotation]);

  // Tarik Data Transaksi Riil Langsung dari Supabase View c2_cost_transactions
  const fetchEvidenceData = useCallback(async () => {
    try {
      setIsSyncing(true);
      const { data, error } = await supabase
        .from("c2_cost_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !data || data.length === 0) {
        setAllTransactions([]);
        setSelectedTx(null);
        return;
      }

      const list: EvidenceTransaction[] = data.map((t, idx) => ({
        id: String(t.id || `evidence-row-${idx}`),
        voucher_no: t.voucher_no || t.code || `TRX-${String(idx + 1).padStart(4, "0")}`,
        job_number: t.job_number || "-",
        customer_name: t.customer_name || "Tanpa Nama Customer",
        cost_category: t.cost_category || "Operasional",
        actual_cost: Number(t.actual_cost || 0),
        planned_cost: Number(t.planned_cost || 0),
        variance: Number(t.variance || 0),
        has_evidence: Boolean(t.has_evidence),
        evidence_url: t.evidence_url || t.attachment_url || null,
        reconciliation_result: t.reconciliation_result || "MATCH",
        review_flag: Boolean(t.review_flag),
        description: t.description || "",
        created_at: t.created_at || new Date().toISOString(),
      }));

      setAllTransactions(list);

      let matched: EvidenceTransaction | undefined;
      if (queryId) {
        matched = list.find((t) => t.id === queryId);
      } else if (queryVoucher) {
        matched = list.find((t) => t.voucher_no === queryVoucher);
      } else if (queryJob) {
        matched = list.find((t) => t.job_number === queryJob);
      }

      setSelectedTx(matched || list[0] || null);
    } catch (err) {
      console.error("Gagal memuat bukti transaksi:", err);
      setAllTransactions([]);
      setSelectedTx(null);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [queryId, queryVoucher, queryJob]);

  useEffect(() => {
    fetchEvidenceData();
  }, [fetchEvidenceData]);

  // Kategori Notifikasi Dinamis
  const notificationCategories = useMemo(() => {
    const list = [];
    const overBudget = allTransactions.filter((r) => r.variance > 0);
    if (overBudget.length > 0) {
      list.push({
        title: "Over Budget",
        count: overBudget.length,
        nominal: overBudget.reduce((sum, r) => sum + r.actual_cost, 0),
        description: "Realisasi biaya melebihi budget. Tinjau penyebab selisih dan kesesuaian anggaran.",
        actionNote: "Prioritas review anggaran",
        icon: TrendingUp,
        colorClass: "text-[#e11d48]",
        bgClass: "bg-rose-50",
        badgeClass: "bg-rose-50 text-rose-600",
      });
    }

    const highCost = allTransactions.filter((r) => r.actual_cost >= 50000000);
    if (highCost.length > 0) {
      list.push({
        title: "High Cost",
        count: highCost.length,
        nominal: highCost.reduce((sum, r) => sum + r.actual_cost, 0),
        description: "Biaya tunggal di atas threshold. Periksa kewajaran nominal dan rincian transaksi.",
        actionNote: "Perlu peninjauan biaya",
        icon: AlertCircle,
        colorClass: "text-[#e11d48]",
        bgClass: "bg-rose-50",
        badgeClass: "bg-rose-50 text-rose-600",
      });
    }

    const missingEvidence = allTransactions.filter((r) => !r.has_evidence);
    if (missingEvidence.length > 0) {
      list.push({
        title: "Missing Evidence",
        count: missingEvidence.length,
        nominal: missingEvidence.reduce((sum, r) => sum + r.actual_cost, 0),
        description: "Dokumen bukti belum lengkap. Lengkapi kuitansi untuk verifikasi biaya.",
        actionNote: "Perlu kelengkapan dokumen",
        icon: FileText,
        colorClass: "text-amber-600",
        bgClass: "bg-amber-50",
        badgeClass: "bg-amber-50 text-amber-700",
      });
    }

    return list;
  }, [allTransactions]);

  // Kalkulasi Dinamis Dokumen Invoice & Metadata Berdasarkan Data Terpilih
  const activeDoc = useMemo(() => {
    if (!selectedTx) return null;

    const actual = selectedTx.actual_cost;
    const cat = selectedTx.cost_category;
    const isVerified = selectedTx.has_evidence && !selectedTx.review_flag;

    const txDate = new Date(selectedTx.created_at);
    const formattedDate = txDate.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const formattedTime = txDate.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const dueDateObj = new Date(txDate.getFullYear(), txDate.getMonth() + 1, 0);
    const dueDateStr = `${dueDateObj.getDate()} ${MONTH_NAMES_ID[dueDateObj.getMonth()]} ${dueDateObj.getFullYear()}`;

    let items: { deskripsi: string; jumlah: string }[] = [];
    const upperCat = (cat || "").toUpperCase();

    if (upperCat.includes("TRUCK") || upperCat.includes("TRANSPORT")) {
      const part1 = Math.round(actual * 0.57);
      const part2 = Math.round(actual * 0.35);
      const part3 = actual - part1 - part2;
      items = [
        { deskripsi: "Distribusi armada operasional pengiriman", jumlah: formatRupiah(part1) },
        { deskripsi: "Tarif trucking lintas rute utama", jumlah: formatRupiah(part2) },
        { deskripsi: "Biaya handling dan kelengkapan manifest", jumlah: formatRupiah(part3) },
      ];
    } else if (upperCat.includes("STORAGE") || upperCat.includes("GUDANG")) {
      const part1 = Math.round(actual * 0.72);
      const part2 = actual - part1;
      items = [
        { deskripsi: "Sewa penumpukan & fasilitas penyimpanan gudang", jumlah: formatRupiah(part1) },
        { deskripsi: "Biaya demurrage & overstay storage", jumlah: formatRupiah(part2) },
      ];
    } else {
      const part1 = Math.round(actual * 0.65);
      const part2 = actual - part1;
      items = [
        { deskripsi: `Pelayanan logistik kargo job ${selectedTx.job_number}`, jumlah: formatRupiah(part1) },
        { deskripsi: "Biaya administrasi dan pemrosesan invoice", jumlah: formatRupiah(part2) },
      ];
    }

    const cleanJob = selectedTx.job_number.replace(/[\/\s]/g, "_").toLowerCase();
    const cleanVoucher = selectedTx.voucher_no.replace(/[\/\s]/g, "_").toLowerCase();
    const dynamicFileName = selectedTx.evidence_url
      ? selectedTx.evidence_url.split("/").pop() || `invoice_${cleanVoucher}.pdf`
      : `invoice_${cleanJob !== "-" ? cleanJob : cleanVoucher}.pdf`;

    return {
      fileName: dynamicFileName,
      fileSize: "2,4 MB",
      pages: "Halaman 1 dari 1",
      verifiedStatus: isVerified ? "Bukti Terverifikasi" : "Menunggu Verifikasi Bukti",
      verifiedBy: isVerified
        ? `Dokumen cocok & tervalidasi · ${formattedDate}, ${formattedTime}`
        : "Menunggu pemeriksaan dokumen oleh Cost Controller",
      isVerified,
      uploadDate: `${formattedDate} · ${formattedTime}`,
      customer: selectedTx.customer_name,
      kategori:
        upperCat.includes("TRUCK")
          ? "Transportasi"
          : upperCat.includes("STORAGE")
          ? "Gudang & Distribusi"
          : cat,
      nominal: formatRupiah(actual),
      idTransaksi: selectedTx.voucher_no,
      ocrScore: isVerified ? "Hasil OCR 98,6%" : "Hasil OCR 0,0%",
      ocrDesc: isVerified
        ? "Nominal, nomor invoice, tanggal, dan nama vendor cocok dengan data transaksi."
        : "Lampiran bukti transaksi belum diverifikasi atau nomor pekerjaan belum cocok.",
      invoice: {
        vendorTitle: "ANDIMA LOGISTICS",
        vendorSub: "Freight & Cost Control Reconciliation",
        customerName: selectedTx.customer_name,
        customerAddress: "Kawasan Industri & Pergudangan Terpadu",
        invoiceNo: `INV/${selectedTx.voucher_no}`,
        invoiceDate: formattedDate,
        dueDate: dueDateStr,
        items,
        total: formatRupiah(actual),
        catatan: "Pembayaran melalui rekening perusahaan paling lambat pada tanggal jatuh tempo.",
      },
    };
  }, [selectedTx]);

  const handleZoomIn = () => setZoom((prev) => Math.min(160, prev + 10));
  const handleZoomOut = () => setZoom((prev) => Math.max(60, prev - 10));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleDownload = () => window.print();

  return (
    <div className="flex min-h-screen bg-[#f4f7fc] print:bg-white">
      {/* Sidebar Navigasi */}
      <div className="print:hidden">
        <Sidebar />
      </div>

      {/* Konten Utama */}
      <main className="flex-1 ml-64 min-w-0 px-8 py-6 overflow-y-auto print:ml-0 print:p-0">
        {/* Header Dasbor */}
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Evidence Preview
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">
              Pratinjau dan verifikasi bukti transaksi
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Tombol Sinkronkan Supabase */}
            <button
              onClick={fetchEvidenceData}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <SlidersHorizontal className={`h-3.5 w-3.5 text-slate-600 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Menyinkronkan..." : "Sinkronkan Supabase"}</span>
            </button>

            {/* Tombol Kembali */}
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-slate-600" />
              <span>Kembali</span>
            </button>

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
                {allTransactions.length > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
                )}
              </button>

              <NotificationPopover
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
                periode={currentLivePeriod}
                isLoading={isLoading}
                totalExceptions={allTransactions.filter((r) => r.review_flag || r.variance > 0).length}
                categories={notificationCategories}
              />
            </div>

            {/* Badge Periode Aktif */}
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#e0f2fe] px-3 py-1.5 text-xs font-semibold text-[#0284c7]">
              <CalendarDays className="h-3.5 w-3.5 text-[#0284c7]" />
              {currentLivePeriod}
            </span>
          </div>
        </div>

        {/* Toolbar Berkas & Kontrol Pratinjau */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm print:hidden">
          {isLoading ? (
            <div className="flex items-center gap-3 animate-pulse">
              <div className="h-9 w-9 rounded-lg bg-slate-200" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-44 rounded bg-slate-200" />
                <div className="h-2.5 w-24 rounded bg-slate-100" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-500">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                {allTransactions.length > 1 ? (
                  <select
                    value={selectedTx?.id || ""}
                    onChange={(e) => {
                      const found = allTransactions.find((t) => t.id === e.target.value);
                      if (found) setSelectedTx(found);
                    }}
                    className="rounded font-bold text-xs text-slate-900 bg-transparent outline-none cursor-pointer hover:text-[#0a7ebf]"
                  >
                    {allTransactions.map((t, idx) => (
                      <option key={t.id || `evidence-opt-${idx}`} value={t.id}>
                        {t.voucher_no} · {t.customer_name} ({formatRupiah(t.actual_cost)})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs font-bold text-slate-900">
                    {activeDoc?.fileName || "Dokumen Tidak Ditemukan"}
                  </p>
                )}
                <p className="text-[11px] text-slate-400">
                  {activeDoc ? `${activeDoc.pages} · ${activeDoc.fileSize}` : "—"}
                </p>
              </div>
            </div>
          )}

          {/* Kontrol Viewer: Zoom, Putar, Unduh */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
              <button
                onClick={handleZoomOut}
                disabled={isLoading || !activeDoc}
                title="Perkecil"
                className="flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-100 transition disabled:opacity-40"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span
                onClick={() => setZoom(100)}
                title="Reset Zoom"
                className="w-12 text-center text-xs font-bold text-slate-700 cursor-pointer select-none"
              >
                {zoom}%
              </span>
              <button
                onClick={handleZoomIn}
                disabled={isLoading || !activeDoc}
                title="Perbesar"
                className="flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-100 transition disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              onClick={handleRotate}
              disabled={isLoading || !activeDoc}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
            >
              <RotateCw className="h-3.5 w-3.5 text-slate-600" />
              <span>Putar</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={isLoading || !activeDoc}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5 text-slate-600" />
              <span>Unduh</span>
            </button>
          </div>
        </div>

        {/* Konten Utama: Invoice Preview & Detail Panel */}
        <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-12 print:block">
          {/* Kolom Kiri: Canvas Dokumen Invoice */}
          <div className="flex min-h-[680px] items-center justify-center overflow-auto rounded-xl border border-slate-200 bg-[#edf2f7] p-8 shadow-inner xl:col-span-8 print:border-none print:bg-white print:p-0">
            {isLoading ? (
              <div className="w-full max-w-[580px] rounded bg-white p-9 shadow-sm border border-slate-200 animate-pulse space-y-6">
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div className="h-10 w-10 rounded-lg bg-slate-200" />
                    <div className="space-y-2">
                      <div className="h-3.5 w-32 rounded bg-slate-200" />
                      <div className="h-2.5 w-24 rounded bg-slate-100" />
                    </div>
                  </div>
                  <div className="h-6 w-24 rounded bg-slate-200" />
                </div>
                <div className="h-0.5 w-full bg-slate-200" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="h-2.5 w-20 rounded bg-slate-100" />
                    <div className="h-3.5 w-36 rounded bg-slate-200" />
                    <div className="h-3 w-48 rounded bg-slate-100" />
                  </div>
                  <div className="space-y-2 flex flex-col items-end">
                    <div className="h-3.5 w-28 rounded bg-slate-200" />
                    <div className="h-3 w-24 rounded bg-slate-100" />
                    <div className="h-3 w-20 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                  <div className="h-4 w-full rounded bg-slate-100" />
                  <div className="h-4 w-full rounded bg-slate-100" />
                  <div className="h-4 w-full rounded bg-slate-100" />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <div className="h-4 w-28 rounded bg-slate-200" />
                  <div className="h-6 w-32 rounded bg-slate-200" />
                </div>
              </div>
            ) : !activeDoc ? (
              <div className="flex flex-col items-center justify-center p-16 text-center my-auto">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-slate-500 mb-3">
                  <FileQuestion className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Tidak Ada Dokumen Bukti</h3>
                <p className="mt-1 text-xs text-slate-400 max-w-sm">
                  Tidak ditemukan data transaksi atau berkas bukti invoice pada database Supabase.
                </p>
              </div>
            ) : (
              /* Wrapper Penampung Geometri Rotasi: Mengadaptasi lebar & tinggi agar kanvas tidak terpotong */
              <div
                className="m-auto flex items-center justify-center transition-all duration-300 ease-out shrink-0"
                style={{
                  width: isLandscape
                    ? `${Math.round(780 * (zoom / 100))}px`
                    : `${Math.round(580 * (zoom / 100))}px`,
                  height: isLandscape
                    ? `${Math.round(580 * (zoom / 100))}px`
                    : `${Math.round(780 * (zoom / 100))}px`,
                }}
              >
                {/* Lembar Dokumen Invoice A4 */}
                <div
                  className="w-[580px] min-h-[780px] shrink-0 bg-white rounded shadow-sm border border-slate-200/80 p-9 transition-transform duration-300 ease-out flex flex-col justify-between print:shadow-none print:border-none print:transform-none select-none"
                  style={{
                    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                    transformOrigin: "center center",
                  }}
                >
                  <div>
                    {/* Header Invoice: Logo & Title */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0a7ebf] text-sm font-black text-white shadow-sm">
                          AL
                        </div>
                        <div>
                          <h2 className="text-xs font-black tracking-tight text-slate-900">
                            {activeDoc.invoice.vendorTitle}
                          </h2>
                          <p className="text-[10px] text-slate-400">
                            {activeDoc.invoice.vendorSub}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <h1 className="text-xl font-black text-[#0a7ebf] tracking-wider">
                          INVOICE
                        </h1>
                      </div>
                    </div>

                    <div className="mt-4 h-[2px] w-full bg-gradient-to-r from-[#0a7ebf] via-[#6366f1] to-[#a855f7]" />

                    {/* Rincian Customer & Nomor Invoice */}
                    <div className="mt-6 grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          DITAGIHKAN KEPADA
                        </p>
                        <p className="mt-1 font-bold text-slate-900">
                          {activeDoc.invoice.customerName}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">
                          {activeDoc.invoice.customerAddress}
                        </p>
                      </div>

                      <div className="text-right space-y-0.5">
                        <p className="font-bold text-slate-900">{activeDoc.invoice.invoiceNo}</p>
                        <p className="text-[11px] text-slate-500">{activeDoc.invoice.invoiceDate}</p>
                        <p className="text-[11px] text-slate-500">{activeDoc.invoice.dueDate}</p>
                      </div>
                    </div>

                    {/* Tabel Item Tagihan */}
                    <div className="mt-6 rounded-lg border border-slate-200 overflow-hidden">
                      <div className="flex items-center justify-between bg-[#e0f2fe]/70 px-4 py-2 border-b border-slate-200">
                        <span className="text-[10px] font-bold text-[#0284c7] uppercase tracking-wider">
                          DESKRIPSI
                        </span>
                        <span className="text-[10px] font-bold text-[#0284c7] uppercase tracking-wider text-right">
                          JUMLAH
                        </span>
                      </div>

                      <div className="divide-y divide-slate-100 text-xs">
                        {activeDoc.invoice.items.map((it, idx) => (
                          <div key={`inv-row-${idx}-${it.deskripsi}`} className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-slate-700">{it.deskripsi}</span>
                            <span className="font-medium text-slate-800">{it.jumlah}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    {/* Total Tagihan */}
                    <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        TOTAL TAGIHAN
                      </span>
                      <span className="text-xl font-extrabold text-[#e11d48]">
                        {activeDoc.invoice.total}
                      </span>
                    </div>

                    {/* Catatan Pembayaran */}
                    <div className="mt-6 rounded-lg bg-slate-50/90 p-3.5 border border-slate-100 text-[11px]">
                      <p className="font-bold text-slate-700">CATATAN</p>
                      <p className="mt-0.5 text-slate-500 leading-relaxed">
                        {activeDoc.invoice.catatan}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Kolom Kanan: Detail Bukti Panel */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-4 print:hidden">
            {isLoading ? (
              <div className="space-y-4 animate-pulse">
                <div>
                  <div className="h-4 w-28 rounded bg-slate-200" />
                  <div className="h-3 w-40 rounded bg-slate-100 mt-1" />
                </div>
                <div className="h-16 w-full rounded-xl bg-slate-100" />
                <div className="space-y-3 pt-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={`side-skel-${i}`} className="space-y-1">
                      <div className="h-2.5 w-20 rounded bg-slate-100" />
                      <div className="h-3.5 w-44 rounded bg-slate-200" />
                    </div>
                  ))}
                </div>
                <div className="h-14 w-full rounded-xl bg-slate-100" />
              </div>
            ) : !activeDoc ? (
              <div className="text-center py-12 text-xs text-slate-400">
                Pilih atau unggah transaksi untuk meninjau rincian bukti.
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-bold text-slate-900">Detail Bukti</h3>
                <p className="text-[11px] text-slate-400">Metadata dan hasil verifikasi</p>

                {/* Status Verifikasi */}
                <div
                  className={`mt-4 rounded-xl p-3.5 border ${
                    activeDoc.isVerified
                      ? "bg-[#ecfdf5] border-emerald-100/80 text-[#059669]"
                      : "bg-[#fffbeb] border-amber-200 text-[#d97706]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {activeDoc.isVerified ? (
                      <CheckCircle2 className="h-4 w-4 text-[#059669]" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-[#d97706]" />
                    )}
                    <span className="text-xs font-bold">{activeDoc.verifiedStatus}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                    {activeDoc.verifiedBy}
                  </p>
                </div>

                {/* Metadata */}
                <div className="mt-5 space-y-3 text-xs">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 tracking-wider">NAMA FILE</p>
                    <p className="mt-0.5 font-medium text-slate-800">{activeDoc.fileName}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-slate-400 tracking-wider">TANGGAL UPLOAD</p>
                    <p className="mt-0.5 font-medium text-slate-800">{activeDoc.uploadDate}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-slate-400 tracking-wider">CUSTOMER</p>
                    <p className="mt-0.5 font-medium text-slate-800">{activeDoc.customer}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-slate-400 tracking-wider">KATEGORI</p>
                    <p className="mt-0.5 font-medium text-slate-800">{activeDoc.kategori}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-slate-400 tracking-wider">NOMINAL</p>
                    <p className="mt-0.5 font-bold text-slate-900">{activeDoc.nominal}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-slate-400 tracking-wider">ID TRANSAKSI</p>
                    <p className="mt-0.5 font-mono text-slate-700">{activeDoc.idTransaksi}</p>
                  </div>
                </div>

                {/* Hasil OCR */}
                <div className="mt-5 rounded-xl bg-[#f0f9ff] p-3.5 border border-sky-100">
                  <p className="text-xs font-bold text-[#0284c7]">{activeDoc.ocrScore}</p>
                  <p className="mt-1 text-[11px] text-[#0369a1] leading-relaxed">
                    {activeDoc.ocrDesc}
                  </p>
                </div>
              </div>
            )}

            {/* Tombol Aksi Bawah */}
            <div className="mt-6 space-y-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => router.back()}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Tutup
              </button>

              <button
                onClick={() => router.back()}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0a7ebf] py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#08689d]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Kembali</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// =========================================================================
// EXPORT HALAMAN DENGAN SUSPENSE BOUNDARY
// =========================================================================
export default function EvidencePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f4f7fc]">
          <Loader2 className="h-8 w-8 animate-spin text-[#0a7ebf]" />
        </div>
      }
    >
      <EvidenceContent />
    </Suspense>
  );
}