"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  FileCheck,
  Loader2,
  RefreshCw,
} from "lucide-react";

import Sidebar from "../dashboard/Sidebar";
import CustomButton from "../dashboard/CustomButton";
import { supabase } from "@/lib/supabase";

interface EvidenceData {
  id: string;
  dbId: string;
  fileName: string;
  fileSize: string;
  totalPages: number;
  uploadDate: string;
  customerName: string;
  kategori: string;
  nominal: string;
  transactionId: string;
  jobNumber: string;
  ocrScore: string;
  ocrSummary: string;
  verifiedBy: string;
  verifiedAt: string;
  isVerified: boolean;
  invoiceData: {
    vendorName: string;
    invoiceNo: string;
    date: string;
    dueDate: string;
    items: { desc: string; amount: string }[];
    total: string;
  };
}

// Fallback Data Riil Dokumen PT Andima Transportindo (Kasus AENAT & BI)
const fallbackEvidenceList: EvidenceData[] = [
  {
    id: "doc-01",
    dbId: "mock-1",
    fileName: "worksheet_AENAT_2609_0354.pdf",
    fileSize: "1,4 MB",
    totalPages: 1,
    uploadDate: "17 September 2026 · 10:50",
    customerName: "PT ATLANTIC CONTAINER LINI",
    kategori: "HANDLING",
    nominal: "Rp 855.342",
    transactionId: "TRX-0926-00627",
    jobNumber: "AENAT/2609/0354",
    ocrScore: "99,4%",
    ocrSummary: "Handling Cost, PPN 11%, RA CMU, Warehouse Garuda, dan PPh 23 cocok 100% dengan lembar kerja operasional.",
    verifiedBy: "Kak Dian (Tax Manager / Cost Controller)",
    verifiedAt: "17 Sep 2026, 11:15 WIB",
    isVerified: true,
    invoiceData: {
      vendorName: "PT ANDIMA TRANSPORTINDO",
      invoiceNo: "INV-26 28597 / 26 28597A",
      date: "04 September 2026",
      dueDate: "18 September 2026",
      items: [
        { desc: "Handling Cost (1-100 KG + Additional rest)", amount: "Rp 107.000" },
        { desc: "PPN (VAT 11%)", amount: "Rp 22.165" },
        { desc: "Reimbursement RA CMU", amount: "Rp 68.182" },
        { desc: "Warehouse Garuda Bandara Soekarno Hatta", amount: "Rp 653.965" },
        { desc: "PPh Pasal 23", amount: "Rp 4.030" },
      ],
      total: "Rp 855.342",
    },
  },
  {
    id: "doc-02",
    dbId: "mock-2",
    fileName: "surat_jalan_trucking_BI3801.pdf",
    fileSize: "2,1 MB",
    totalPages: 1,
    uploadDate: "15 September 2026 · 09:30",
    customerName: "PT CEVA AIR OCEAN INDONESIA",
    kategori: "TRUCKING",
    nominal: "Rp 95.000",
    transactionId: "2606-006",
    jobNumber: "BI/2608/3801",
    ocrScore: "84,0%",
    ocrSummary: "Peringatan: Terdapat selisih over budget Rp 17.950 dari pagu rencana Rp 77.050. Menunggu verifikasi justifikasi.",
    verifiedBy: "Belum diverifikasi",
    verifiedAt: "-",
    isVerified: false,
    invoiceData: {
      vendorName: "ARMADA LOGISTIK SURABAYA",
      invoiceNo: "INV/ALS/SBY/2608-38",
      date: "15 September 2026",
      dueDate: "25 September 2026",
      items: [
        { desc: "Biaya Trucking Pengiriman Kargo Surabaya", amount: "Rp 95.000" },
      ],
      total: "Rp 95.000",
    },
  },
];

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function EvidencePage() {
  const router = useRouter();

  const [evidenceItems, setEvidenceItems] = useState<EvidenceData[]>(fallbackEvidenceList);
  const [selectedDocId, setSelectedDocId] = useState<string>("doc-01");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingDb, setIsUpdatingDb] = useState(false);

  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [activeDoc, setActiveDoc] = useState<EvidenceData>(fallbackEvidenceList[0]);
  const [hmacSecondsLeft, setHmacSecondsLeft] = useState<number>(15 * 60);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // 1. Ambil Data Transaksi dari Supabase
  const fetchEvidenceFromSupabase = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("c2_cost_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !data || data.length === 0) {
        console.warn("Memuat data evidence lokal (fallback)...");
        setEvidenceItems(fallbackEvidenceList);
        setActiveDoc(fallbackEvidenceList[0]);
        return;
      }

      // Ambil transaksi yang ada nomor job
      const formatted: EvidenceData[] = data.map((item, idx) => {
        const actual = Number(item.actual_cost || 0);
        const planned = Number(item.planned_cost || 0);
        const variance = Number(item.variance || (actual - planned) || 0);

        return {
          id: `doc-${String(idx + 1).padStart(2, "0")}`,
          dbId: item.id,
          fileName: `bukti_${item.job_number.replace(/[\/\s]/g, "_")}.pdf`,
          fileSize: "1,4 MB",
          totalPages: 1,
          uploadDate: new Date(item.created_at || Date.now()).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          customerName: item.customer_name || "PT Unknown Customer",
          kategori: item.cost_category || "HANDLING",
          nominal: formatRupiah(actual),
          transactionId: item.voucher_no || `TRX-${String(idx + 1).padStart(4, "0")}`,
          jobNumber: item.job_number,
          ocrScore: item.has_evidence ? "98,8%" : "0,0%",
          ocrSummary: item.has_evidence
            ? "Kuitansi dan invoice fisik telah terverifikasi cocok dengan nominal pembukuan."
            : "Berkas digital kuitansi belum diunggah atau membutuhkan audit bukti fisik.",
          verifiedBy: item.has_evidence ? "Kak Dian (Tax Manager / Cost Controller)" : "Belum diverifikasi",
          verifiedAt: item.has_evidence ? "Terverifikasi" : "-",
          isVerified: Boolean(item.has_evidence),
          invoiceData: {
            vendorName: item.customer_name || "PT ANDIMA TRANSPORTINDO",
            invoiceNo: item.voucher_no || `INV-${item.job_number}`,
            date: "September 2026",
            dueDate: "Akhir Periode September 2026",
            items: [
              {
                desc: item.description || `Operasional kargo logistik (${item.cost_category})`,
                amount: formatRupiah(actual),
              },
            ],
            total: formatRupiah(actual),
          },
        };
      });

      setEvidenceItems(formatted);
      const initial = formatted.find((d) => d.id === selectedDocId) || formatted[0];
      setActiveDoc(initial);
    } catch (err) {
      console.error("Gagal membaca bukti transaksi dari Supabase:", err);
      setEvidenceItems(fallbackEvidenceList);
      setActiveDoc(fallbackEvidenceList[0]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvidenceFromSupabase();
  }, []);

  // Perbarui Dokumen Aktif saat Dropdown Berubah
  useEffect(() => {
    const doc = evidenceItems.find((d) => d.id === selectedDocId) || evidenceItems[0];
    if (doc) {
      setActiveDoc(doc);
      setCurrentPage(1);
      setRotation(0);
      setZoom(100);
    }
  }, [selectedDocId, evidenceItems]);

  // Timer Countdown URL Presigned HMAC (15 Menit)
  useEffect(() => {
    const timer = setInterval(() => {
      setHmacSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const showNotification = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(180, prev + 10));
  const handleZoomOut = () => setZoom((prev) => Math.max(60, prev - 10));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handlePrintOrDownload = () => {
    showNotification("Membuka dialog cetak / Simpan sebagai PDF...");
    window.print();
  };

  // Toggle Verifikasi Nyata ke Database Supabase
  const handleToggleVerification = async () => {
    if (!activeDoc) return;

    try {
      setIsUpdatingDb(true);
      const nextVerifiedStatus = !activeDoc.isVerified;

      // Update kolom has_evidence dan review_flag di Supabase
      if (activeDoc.dbId && !activeDoc.dbId.startsWith("mock-")) {
        const { error } = await supabase
          .from("c2_cost_transactions")
          .update({
            has_evidence: nextVerifiedStatus,
            review_flag: !nextVerifiedStatus, // Jika bukti sudah disahkan, hilangkan tanda review
            description: nextVerifiedStatus
              ? "Bukti fisik telah divalidasi sah oleh Kak Dian (Tax Manager)"
              : "Verifikasi bukti dibatalkan untuk pemeriksaan ulang",
          })
          .eq("id", activeDoc.dbId);

        if (error) throw error;
      }

      // Perbarui state lokal
      const updatedTime =
        new Date().toLocaleString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }) + " WIB";

      setActiveDoc((prev) => ({
        ...prev,
        isVerified: nextVerifiedStatus,
        verifiedBy: nextVerifiedStatus ? "Kak Dian (Tax Manager / Cost Controller)" : "Belum diverifikasi",
        verifiedAt: nextVerifiedStatus ? updatedTime : "-",
      }));

      setEvidenceItems((prev) =>
        prev.map((item) =>
          item.id === activeDoc.id
            ? {
                ...item,
                isVerified: nextVerifiedStatus,
                verifiedBy: nextVerifiedStatus ? "Kak Dian (Tax Manager / Cost Controller)" : "Belum diverifikasi",
                verifiedAt: nextVerifiedStatus ? updatedTime : "-",
              }
            : item
        )
      );

      showNotification(
        nextVerifiedStatus
          ? `Bukti transaksi untuk job ${activeDoc.jobNumber} berhasil disahkan & disimpan ke Supabase.`
          : `Status verifikasi bukti job ${activeDoc.jobNumber} telah dibatalkan.`
      );
    } catch (err: any) {
      console.error("Gagal memperbarui verifikasi ke Supabase:", err);
      showNotification(`Gagal menyimpan verifikasi ke database: ${err.message}`);
    } finally {
      setIsUpdatingDb(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f4f7fb] print:bg-white">
      {/* Sembunyikan sidebar saat cetak PDF */}
      <div className="print:hidden">
        <Sidebar />
      </div>

      <main className="flex-1 px-8 py-6 print:p-0">
        {/* Header Modul */}
        <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Evidence Preview</h1>
            <p className="text-xs text-slate-500">
              Pratinjau, inspeksi kuitansi operasional, dan verifikasi kuitansi digital PT Andima Transportindo (FR-CCR2-002)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <CustomButton variant="outline" onClick={fetchEvidenceFromSupabase}>
              <RefreshCw className="h-4 w-4" /> Sinkronkan Database
            </CustomButton>

            <CustomButton variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" /> Kembali
            </CustomButton>

            <button
              aria-label="Notifikasi"
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
            </button>

            <span className="flex items-center gap-2 rounded-lg bg-sky-100 px-3 py-2.5 text-xs font-bold text-sky-700">
              <CalendarDays className="h-4 w-4" /> September 2026
            </span>
          </div>
        </div>

        {/* Notifikasi Toast */}
        {feedbackToast && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 shadow-sm animate-in fade-in duration-200 print:hidden">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-bold text-emerald-900">{feedbackToast}</p>
            </div>
            <button
              onClick={() => setFeedbackToast(null)}
              className="text-emerald-700 hover:text-emerald-950"
            >
              &times;
            </button>
          </div>
        )}

        {/* Toolbar File & Viewer */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-800 outline-none focus:border-sky-400"
                >
                  {evidenceItems.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.jobNumber} · {d.fileName}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Halaman {currentPage} dari {activeDoc.totalPages} · {activeDoc.fileSize}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 rounded"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs font-bold text-slate-700">
                {currentPage} / {activeDoc.totalPages}
              </span>
              <button
                disabled={currentPage >= activeDoc.totalPages}
                onClick={() => setCurrentPage((p) => Math.min(activeDoc.totalPages, p + 1))}
                className="flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 rounded"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={handleZoomOut}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
              title="Perkecil"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span
              onClick={() => setZoom(100)}
              title="Klik untuk reset zoom (100%)"
              className="w-14 cursor-pointer text-center text-xs font-bold text-slate-700 hover:text-sky-600 select-none"
            >
              {zoom}%
            </span>
            <button
              onClick={handleZoomIn}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
              title="Perbesar"
            >
              <Plus className="h-4 w-4" />
            </button>

            <CustomButton variant="outline" size="sm" onClick={handleRotate}>
              <RotateCw className="h-4 w-4" /> Putar {rotation > 0 ? `(${rotation}°)` : ""}
            </CustomButton>

            <CustomButton variant="outline" size="sm" onClick={handlePrintOrDownload}>
              <Download className="h-4 w-4" /> Unduh / Cetak PDF
            </CustomButton>
          </div>
        </div>

        {/* Konten Pratinjau + Detail Dokumen */}
        {isLoading ? (
          <div className="mt-8 flex h-64 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white">
            <Loader2 className="h-7 w-7 animate-spin text-sky-600" />
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Memuat berkas bukti transaksi dari Supabase...
            </p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr] print:block">
            {/* Canvas Area Invoice / Kuitansi */}
            <div className="flex min-h-[620px] items-start justify-center overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-8 shadow-inner print:border-none print:bg-white print:p-0 print:shadow-none">
              <div
                className="bg-white shadow-xl transition-all duration-200 ease-out border border-slate-200 print:border-none print:shadow-none print:w-full print:max-w-none print:p-0"
                style={{
                  width: `${zoom}%`,
                  maxWidth: "700px",
                  padding: "36px",
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                }}
              >
                {/* Header Invoice PT Andima */}
                <div className="flex items-start justify-between border-b-4 border-[#18C7C0] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#07111F] text-sm font-black text-white shadow-sm">
                      AT
                    </div>
                    <div>
                      <p className="text-sm font-extrabold tracking-tight text-slate-900">
                        PT ANDIMA TRANSPORTINDO
                      </p>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        Gedung Menara MTH Lantai 6 Suite 604, Jakarta Selatan
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-[#0a7ebf] tracking-wide">WORKSHEET</p>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">COST CONTROL & RECONCILIATION</p>
                  </div>
                </div>

                {/* Rincian Customer & Job */}
                <div className="mt-6 grid grid-cols-2 gap-6 text-[11px]">
                  <div>
                    <p className="font-bold uppercase tracking-wider text-slate-400">Entitas Pelanggan (Customer)</p>
                    <p className="mt-1 text-sm font-bold text-slate-800">{activeDoc.customerName}</p>
                    <p className="text-slate-500 mt-0.5 leading-relaxed">
                      Dokumen lampiran kuitansi pengeluaran operasional resmi PT Andima
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <div>
                      <span className="font-bold text-slate-400 text-[10px] uppercase">Nomor Job: </span>
                      <span className="font-bold font-mono text-sky-800">
                        {activeDoc.jobNumber}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-400 text-[10px] uppercase">Voucher Kas/Bank: </span>
                      <span className="font-semibold text-slate-700">{activeDoc.transactionId}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-400 text-[10px] uppercase">Periode: </span>
                      <span className="text-slate-600 font-semibold">{activeDoc.invoiceData.date}</span>
                    </div>
                  </div>
                </div>

                {/* Tabel Item Komponen Biaya Baku (TRUCKING / HANDLING / STORAGE) */}
                <div className="mt-6 rounded-lg border border-slate-200 overflow-hidden">
                  <div className="grid grid-cols-12 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <span className="col-span-8">Deskripsi Komponen Biaya</span>
                    <span className="col-span-4 text-right">Jumlah Biaya Aktual (IDR)</span>
                  </div>
                  <div className="divide-y divide-slate-100 text-[12px]">
                    {activeDoc.invoiceData.items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 px-4 py-2.5">
                        <span className="col-span-8 text-slate-700 font-medium">{item.desc}</span>
                        <span className="col-span-4 text-right font-semibold text-slate-800">
                          {item.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total Tagihan */}
                <div className="mt-6 flex items-center justify-between border-t-2 border-slate-200 pt-4">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      TOTAL PENGELUARAN AKTUAL
                    </p>
                    <p className="text-[10px] text-slate-400">Tercatat pada jurnal Smart Accounting PT Andima</p>
                  </div>
                  <p className="text-2xl font-black text-[#d4194f]">{activeDoc.nominal}</p>
                </div>

                {/* Catatan Validasi & Cap Digital */}
                <div className="mt-6 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px]">
                  <div className="max-w-[380px]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Jejak Pemeriksaan (FAT Department)
                    </p>
                    <p className="mt-0.5 text-slate-600">
                      Dokumen sah sebagai bukti rekonsiliasi biaya bulanan C2 (Cost Control & Reconciliation).
                    </p>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded border border-slate-300 bg-white text-[9px] font-bold text-slate-600">
                      FAT-C2
                    </div>
                    <span className="text-[9px] font-bold text-emerald-600 mt-1">VERIFIED</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel Detail Bukti & Validasi Keuangan */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Detail Bukti Transaksi</h3>
                  <div className="flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                    <Clock className="h-3 w-3" />
                    <span>HMAC URL: {formatCountdown(hmacSecondsLeft)}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">Metadata transaksi dan jejak audit verifikasi</p>

                {/* Status Verifikasi Controller */}
                <div
                  className={`mt-4 rounded-lg border p-3 ${
                    activeDoc.isVerified
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {activeDoc.isVerified ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    )}
                    <p className="text-[13px] font-bold">
                      {activeDoc.isVerified ? "Bukti Sah & Terverifikasi" : "Menunggu Pemeriksaan Controller"}
                    </p>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                    {activeDoc.isVerified
                      ? `Telah diverifikasi oleh ${activeDoc.verifiedBy}`
                      : "Lampiran belum disahkan secara manual oleh Kak Dian (Tax Manager)."}
                  </p>
                </div>

                {/* Metadata Transaksi */}
                <div className="mt-4 space-y-2.5 text-[12px]">
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Nama Berkas
                    </span>
                    <span className="font-semibold text-slate-800">{activeDoc.fileName}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Tanggal Ingesti
                    </span>
                    <span className="font-semibold text-slate-800">{activeDoc.uploadDate}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Entitas Pelanggan
                    </span>
                    <span className="font-bold text-slate-900">{activeDoc.customerName}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Kategori Komponen
                    </span>
                    <span className="font-semibold text-slate-800">{activeDoc.kategori}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Nomor Job (CRM)
                    </span>
                    <span className="font-mono font-bold text-sky-700">{activeDoc.jobNumber}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      No. Voucher / Transaksi
                    </span>
                    <span className="font-mono font-semibold text-slate-700">{activeDoc.transactionId}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Nominal Aktual
                    </span>
                    <span className="font-black text-slate-900 text-sm">{activeDoc.nominal}</span>
                  </div>
                </div>

                {/* Hasil Inspeksi OCR */}
                <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-sky-800 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-sky-600" /> Hasil OCR Engine
                    </p>
                    <span className="text-[11px] font-extrabold text-sky-700">{activeDoc.ocrScore} Akurasi</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-sky-700">{activeDoc.ocrSummary}</p>
                </div>
              </div>

              {/* Tombol Aksi Verifikasi */}
              <div className="mt-6 space-y-2 border-t border-slate-100 pt-4">
                <button
                  disabled={isUpdatingDb}
                  onClick={handleToggleVerification}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold text-white transition disabled:opacity-60 ${
                    activeDoc.isVerified
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {isUpdatingDb ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileCheck className="h-4 w-4" />
                  )}
                  {activeDoc.isVerified ? "Batalkan Pengesahan Bukti" : "Sahkan & Verifikasi Bukti ke Supabase"}
                </button>

                <button
                  onClick={() => router.back()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0a7ebf] py-2.5 text-xs font-bold text-white transition hover:bg-[#08689d]"
                >
                  <ArrowLeft className="h-4 w-4" /> Kembali ke Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}