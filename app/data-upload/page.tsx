"use client";

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ExcelJS from "exceljs";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Download,
  Bell,
  CalendarDays,
  Info,
  ListChecks,
  SlidersHorizontal,
  RefreshCw,
  Loader2,
  Play,
  X,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  Check,
} from "lucide-react";

import Sidebar from "@/components/sidebar";
import CustomDropdown, { DropdownOption } from "../dashboard/CustomDropdown";
import { supabase } from "@/lib/supabase";

export interface TransactionRecord {
  id: string;
  recordId: string;
  customerName: string;
  category: string;
  amount: number;
  status: "Valid" | "Warning" | "Invalid";
  reasons: string[];
  jobNumber?: string;
  hasEvidence?: boolean;
  voucherNo?: string;
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

const defaultJenisOptions: DropdownOption[] = [
  { value: "Monthly Cost C2", label: "Monthly Cost C2" },
  { value: "Monthly Sales C1", label: "Monthly Sales C1" },
];

const formatRupiah = (val: number) => `Rp ${val.toLocaleString("id-ID")}`;

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
      <div className="mt-3">
        <div className="h-7 w-20 rounded bg-slate-200" />
      </div>
      <div className="mt-3 h-3 w-32 rounded bg-slate-100" />
    </div>
  );
}

function TableSkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="py-3.5 px-2"><div className="h-4 w-24 rounded bg-slate-200" /></td>
      <td className="py-3.5 px-2"><div className="h-4 w-36 rounded bg-slate-200" /></td>
      <td className="py-3.5 px-2"><div className="h-4 w-20 rounded bg-slate-100" /></td>
      <td className="py-3.5 px-2"><div className="h-4 w-28 rounded bg-slate-200" /></td>
      <td className="py-3.5 px-2 text-center"><div className="mx-auto h-5 w-16 rounded-full bg-slate-200" /></td>
    </tr>
  );
}

// =========================================================================
// SUB-KOMPONEN: NOTIFICATION POPOVER (REAL-TIME DARI SUPABASE)
// =========================================================================
interface NotificationPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  periode: string;
  onViewAllExceptions?: () => void;
  dbExceptions: any[];
}

function NotificationPopover({
  isOpen,
  onClose,
  periode,
  onViewAllExceptions,
  dbExceptions,
}: NotificationPopoverProps) {
  const [activeTab, setActiveTab] = useState<"semua" | "belum_dibaca">("semua");
  const [isMarkedAllRead, setIsMarkedAllRead] = useState(false);

  const notifSummary = useMemo(() => {
    let overBudget = 0;
    let overBudgetSum = 0;
    let highCost = 0;
    let highCostSum = 0;
    let missingEvidence = 0;
    let missingEvidenceSum = 0;

    dbExceptions.forEach((t) => {
      const actual = Number(t.actual_cost) || 0;
      if (t.variance > 0 || t.exception_tags?.includes("OVER_BUDGET")) {
        overBudget++;
        overBudgetSum += actual;
      }
      if (actual >= 50_000_000) {
        highCost++;
        highCostSum += actual;
      }
      if (!t.has_evidence || t.exception_tags?.includes("MISSING_EVIDENCE")) {
        missingEvidence++;
        missingEvidenceSum += actual;
      }
    });

    const total = overBudget + highCost + missingEvidence;

    return {
      total,
      overBudgetCount: overBudget,
      overBudgetValue: formatCompactRupiah(overBudgetSum),
      highCostCount: highCost,
      highCostValue: formatCompactRupiah(highCostSum),
      missingEvidenceCount: missingEvidence,
      missingEvidenceValue: formatCompactRupiah(missingEvidenceSum),
    };
  }, [dbExceptions]);

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

          <p className="mt-2 text-xs font-bold text-slate-800">
            {notifSummary.total} exception perlu tindak lanjut
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

        <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
          {activeTab === "belum_dibaca" && isMarkedAllRead ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Semua notifikasi telah ditandai dibaca.
            </div>
          ) : notifSummary.total === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Tidak ada anomali atau exception yang tercatat di database.
            </div>
          ) : (
            <>
              {/* Over Budget */}
              <div className="flex gap-3.5 p-5 transition hover:bg-slate-50/60">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-[#e11d48]">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900">Over Budget</h3>
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                      {notifSummary.overBudgetCount} item
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {notifSummary.overBudgetValue}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    Realisasi biaya melebihi budget. Tinjau penyebab selisih dan kesesuaian anggaran.
                  </p>
                </div>
              </div>

              {/* High Cost */}
              <div className="flex gap-3.5 p-5 transition hover:bg-slate-50/60">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-[#e11d48]">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900">High Cost</h3>
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                      {notifSummary.highCostCount} item
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {notifSummary.highCostValue}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    Biaya tunggal di atas threshold rule. Periksa kewajaran nominal transaksi.
                  </p>
                </div>
              </div>

              {/* Missing Evidence */}
              <div className="flex gap-3.5 p-5 transition hover:bg-slate-50/60">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900">Missing Evidence</h3>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      {notifSummary.missingEvidenceCount} item
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {notifSummary.missingEvidenceValue}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    Dokumen bukti belum lengkap. Lengkapi berkas untuk verifikasi biaya.
                  </p>
                </div>
              </div>
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
// KOMPONEN UTAMA: DATA UPLOAD PAGE
// =========================================================================
export default function DataUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentLivePeriod = useMemo(() => getDynamicPeriod(0), []);

  const dynamicPeriodeOptions: DropdownOption[] = useMemo(() => [
    { value: getDynamicPeriod(0), label: getDynamicPeriod(0) },
    { value: getDynamicPeriod(1), label: getDynamicPeriod(1) },
    { value: getDynamicPeriod(2), label: getDynamicPeriod(2) },
    { value: getDynamicPeriod(3), label: getDynamicPeriod(3) },
  ], []);

  const [periode, setPeriode] = useState<string>(currentLivePeriod);
  const [jenis, setJenis] = useState("Monthly Cost C2");
  const [entitas, setEntitas] = useState("");
  const [dynamicEntitasOptions, setDynamicEntitasOptions] = useState<DropdownOption[]>([]);

  // State Loading & Sinkronisasi
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [dbExceptions, setDbExceptions] = useState<any[]>([]);

  // State Berkas
  const [dragging, setDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [validationStage, setValidationStage] = useState("Menunggu masukan berkas...");
  const [loadedFile, setLoadedFile] = useState<{
    name: string;
    size: string;
    rowCount: number;
  } | null>(null);

  // State Baris Data
  const [records, setRecords] = useState<TransactionRecord[]>([]);
  const [filterTab, setFilterTab] = useState<"Semua" | "Invalid" | "Warning">("Semua");
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitSuccessData, setCommitSuccessData] = useState<{
    batchId: string;
    count: number;
  } | null>(null);

  // Tarik Data Nyata Supabase dengan delay 800ms agar skeleton terlihat
  const loadDatabaseData = useCallback(async () => {
    try {
      setIsSyncing(true);
      setIsLoading(true);

      const [res] = await Promise.all([
        supabase.from("c2_cost_transactions").select("*").order("created_at", { ascending: false }),
        new Promise((resolve) => setTimeout(resolve, 800)), // Jeda waktu agar skeleton tampil jelas
      ]);

      if (!res.error && res.data) {
        setDbExceptions(res.data);
        const uniqueEntities = Array.from(new Set(res.data.map((d) => d.customer_name).filter(Boolean)));
        if (uniqueEntities.length > 0) {
          const opts = uniqueEntities.map((name) => ({ value: name, label: name }));
          setDynamicEntitasOptions(opts);
          if (!entitas) setEntitas(opts[0].value);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, [entitas]);

  useEffect(() => {
    loadDatabaseData();
  }, [loadDatabaseData]);

  // Kalkulasi KPI Dinamis
  const kpiCounts = useMemo(() => {
    const total = records.length;
    const valid = records.filter((r) => r.status === "Valid").length;
    const invalid = records.filter((r) => r.status === "Invalid").length;
    const warning = records.filter((r) => r.status === "Warning").length;
    const processable = valid + warning;

    return { total, valid, invalid, warning, processable };
  }, [records]);

  const displayedRecords = useMemo(() => {
    if (filterTab === "Invalid") return records.filter((r) => r.status === "Invalid");
    if (filterTab === "Warning") return records.filter((r) => r.status === "Warning");
    return records;
  }, [records, filterTab]);

  const handleDownloadTemplate = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        "voucher_no,period_month,branch_code,customer_name,job_number,cost_category,amount,has_evidence",
        `BR26-06050,${periode},Jakarta Pusat,PT Nusantara Retail,AENAT/2606/0212,TRUCKING,42850000,TRUE`,
        `BR26-06051,${periode},Surabaya,PT Sinar Logistik,AENAT/2606/0215,STORAGE,31240000,TRUE`,
        `BR26-06052,${periode},Jakarta Pusat,CV Maju Bersama,AENAT/2606/0217,HANDLING,18760000,FALSE`,
        `BR26-06053,${periode},Semarang,PT Garuda Teknologi,UNMATCHED,OTHER_OPERATIONAL,24500000,FALSE`,
        `BR26-06054,${periode},Jakarta Pusat,PT Nusantara Retail,DSVEXP/2605/2551,TRUCKING,12980000,TRUE`,
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Template_Ingestion_PT_Andima_${periode.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processUploadedFile = async (file: File) => {
    setCommitSuccessData(null);
    setIsValidating(true);
    setProgress(20);
    setValidationStage("Membaca stream berkas...");

    const mb = (file.size / (1024 * 1024)).toFixed(1).replace(".", ",");

    try {
      const parsedList: TransactionRecord[] = [];

      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        setProgress(50);
        setValidationStage("Memeriksa format & duplikasi data...");

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
          if (cols.length < 5) continue;

          const voucherNo = cols[0] || `VCH-${String(i).padStart(4, "0")}`;
          const customerName = cols[3] || "PT Nusantara Retail";
          const jobNumber = cols[4] || "UNMATCHED";
          const category = cols[5] || "Operasional";
          const rawAmount = parseFloat(cols[6] || "0");
          const hasEvidence = cols[7]?.toUpperCase() === "TRUE" || cols[7] === "1";

          let status: "Valid" | "Warning" | "Invalid" = "Valid";
          const reasons: string[] = [];

          if (isNaN(rawAmount) || rawAmount <= 0) {
            status = "Invalid";
            reasons.push("Nominal tidak valid / negatif");
          }

          if (jobNumber === "UNMATCHED" || jobNumber.includes("UNKNOWN")) {
            if (status !== "Invalid") status = "Warning";
            reasons.push("JOB NOT FOUND");
          }

          if (!hasEvidence) {
            if (status !== "Invalid") status = "Warning";
            reasons.push("MISSING EVIDENCE");
          }

          parsedList.push({
            id: `row-${i}`,
            recordId: `C2-SEP-${String(i).padStart(4, "0")}`,
            customerName,
            category,
            amount: isNaN(rawAmount) ? 0 : rawAmount,
            status,
            reasons: reasons.length ? reasons : ["Semua atribut valid"],
            jobNumber,
            hasEvidence,
            voucherNo,
          });
        }
      } else if (file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls")) {
        setProgress(40);
        setValidationStage("Mengekstrak lembar kerja Excel...");
        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];

        setProgress(70);
        setValidationStage("Validasi struktur 7 atribut wajib...");

        let rowIdx = 1;
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const values = row.values as any[];
          if (!values || values.length < 5) return;

          const voucher = String(values[1] || `VCH-${String(rowIdx).padStart(4, "0")}`);
          const cust = String(values[4] || values[2] || "PT Nusantara Retail");
          const job = String(values[5] || "AENAT/2606/0212");
          const cat = String(values[6] || "Transportasi");
          const amt = Number(values[7] || 10000000);
          const hasEvidenceVal = String(values[8]).toUpperCase() === "TRUE";

          let st: "Valid" | "Warning" | "Invalid" = "Valid";
          if (amt <= 0) st = "Invalid";
          else if (!hasEvidenceVal || job === "UNMATCHED") st = "Warning";

          parsedList.push({
            id: `row-${rowIdx}`,
            recordId: `C2-SEP-${String(rowIdx).padStart(4, "0")}`,
            customerName: cust,
            category: cat,
            amount: amt,
            status: st,
            reasons: [st === "Valid" ? "Semua atribut valid" : "Perlu verifikasi"],
            jobNumber: job,
            hasEvidence: hasEvidenceVal,
            voucherNo: voucher,
          });
          rowIdx++;
        });
      }

      // Berikan jeda 600ms agar skeleton tabel terlihat saat parsing
      await new Promise((r) => setTimeout(r, 600));

      setProgress(100);
      setValidationStage("Pemeriksaan selesai.");

      setIsValidating(false);
      setLoadedFile({
        name: file.name,
        size: `${mb} MB`,
        rowCount: parsedList.length,
      });
      setRecords(parsedList);
    } catch (err) {
      console.error(err);
      setIsValidating(false);
      setProgress(0);
      setValidationStage("Gagal memproses berkas.");
    }
  };

  const handleCommitData = async () => {
    try {
      setIsCommitting(true);

      const processableList = records.filter((r) => r.status !== "Invalid");
      if (processableList.length === 0) return;

      const payload = processableList.map((r) => ({
        job_number: r.jobNumber || "AENAT/2606/0212",
        customer_name: r.customerName,
        branch_code: "Jakarta Pusat",
        cost_category: r.category.toUpperCase().includes("GUDANG")
          ? "STORAGE"
          : r.category.toUpperCase().includes("OPERASIONAL")
          ? "HANDLING"
          : "TRUCKING",
        period_month: periode,
        planned_cost: r.amount,
        actual_cost: r.amount,
        has_evidence: r.hasEvidence !== false,
        reconciliation_result: r.status === "Warning" ? "OVER" : "MATCH",
        review_flag: r.status === "Warning",
        exception_tags: r.status === "Warning" ? ["MISSING_EVIDENCE"] : [],
        voucher_no: r.voucherNo || r.recordId,
        description: `Import file ${loadedFile?.name || "manual_upload"}`,
      }));

      const { error } = await supabase.from("cost_actual_transactions").insert(payload);

      if (error) {
        console.error("Gagal simpan Supabase:", error.message);
      } else {
        setCommitSuccessData({
          batchId: `BATCH-${Date.now().toString().slice(-6)}`,
          count: processableList.length,
        });
        loadDatabaseData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleCancel = () => {
    setLoadedFile(null);
    setRecords([]);
    setProgress(0);
    setValidationStage("Menunggu masukan berkas...");
    setCommitSuccessData(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // State loading aktif ketika pertama kali buka halaman atau saat berkas sedang divalidasi
  const isDisplayLoading = isLoading || isValidating;

  return (
    <div className="flex min-h-screen w-full bg-[#f4f7fc]">
      {/* Sidebar Navigasi Bersatu */}
      <Sidebar />

      {/* Konten Utama */}
      <main className="flex-1 min-w-0 px-8 py-6 lg:ml-[260px] overflow-y-auto">
        {/* Header Modul */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Data Upload
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">
              Impor data cost bulanan melalui CSV atau Excel
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Tombol Sinkronkan Supabase */}
            <button
              onClick={loadDatabaseData}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <SlidersHorizontal className={`h-3.5 w-3.5 text-slate-600 ${isSyncing ? "animate-spin" : ""}`} />
              <span>Sinkronkan Supabase</span>
            </button>

            {/* Tombol Unduh Template */}
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5 text-slate-600" />
              <span>Unduh Template</span>
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
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
              </button>

              <NotificationPopover
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
                periode={periode}
                onViewAllExceptions={() => router.push("/cost-exception")}
                dbExceptions={dbExceptions}
              />
            </div>

            {/* Badge Periode Aktif Real-Time */}
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#e0f2fe] px-3 py-1.5 text-xs font-semibold text-[#0284c7]">
              <CalendarDays className="h-3.5 w-3.5 text-[#0284c7]" />
              {currentLivePeriod}
            </span>
          </div>
        </div>

        {/* Notifikasi Sukses Commit Data */}
        {commitSuccessData && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <Check className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-xs font-bold text-emerald-950">
                  {commitSuccessData.count} Transaksi Berhasil Disimpan ke Supabase! (#{commitSuccessData.batchId})
                </p>
                <p className="text-[11px] text-emerald-700">
                  Data staging berhasil disinkronkan dan langsung teragregasi di halaman Dashboard.
                </p>
              </div>
            </div>
            <button
              onClick={() => setCommitSuccessData(null)}
              className="text-xs font-bold text-emerald-700 hover:underline"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Filter Bar Parameter Ingesti */}
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <div className="w-52">
            <CustomDropdown
              label="Periode Data"
              value={periode}
              options={dynamicPeriodeOptions}
              onChange={setPeriode}
            />
          </div>

          <div className="w-56">
            <CustomDropdown
              label="Jenis Data"
              value={jenis}
              options={defaultJenisOptions}
              onChange={setJenis}
            />
          </div>

          <div className="w-56">
            <CustomDropdown
              label="Entitas"
              value={entitas}
              options={dynamicEntitasOptions}
              onChange={setEntitas}
            />
          </div>

          <div className="inline-flex h-[38px] items-center gap-1.5 rounded-lg bg-[#e0f2fe] px-3 text-xs font-semibold text-[#0284c7]">
            <Info className="h-4 w-4 text-[#0284c7]" />
            <span>Gunakan format template versi 3.2</span>
          </div>
        </div>

        {/* Zona Upload & Panel File Terpilih */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                processUploadedFile(e.dataTransfer.files[0]);
              }
            }}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
              dragging
                ? "border-sky-500 bg-sky-50/70"
                : "border-sky-200 bg-white hover:border-sky-300"
            }`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-600">
              <UploadCloud className="h-6 w-6" />
            </div>

            <p className="mt-3 text-sm font-semibold text-slate-800">
              Tarik file ke sini atau pilih dari perangkat
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Format .xlsx, .xls, atau .csv · Maksimal 25 MB
            </p>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <FileText className="h-3.5 w-3.5 text-slate-600" />
              <span>Pilih File</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  processUploadedFile(e.target.files[0]);
                }
              }}
            />
          </div>

          {/* Panel File Terpilih */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">File Terpilih</h3>
                  <p className="text-[11px] text-slate-400">
                    {loadedFile ? "Siap divalidasi" : "Belum ada berkas yang dipilih"}
                  </p>
                </div>
                {loadedFile && !isValidating && (
                  <button
                    onClick={handleCancel}
                    title="Ganti Berkas"
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}
              </div>

              {loadedFile ? (
                <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50/80 p-3.5 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 truncate max-w-[180px]">
                        {loadedFile.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {loadedFile.rowCount.toLocaleString("id-ID")} baris · {loadedFile.size}
                      </p>
                    </div>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                </div>
              ) : (
                <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-6 text-center text-slate-400">
                  <FileSpreadsheet className="h-8 w-8 text-slate-300 stroke-1" />
                  <p className="mt-2 text-xs font-medium text-slate-500">Belum ada file dipilih</p>
                  <p className="text-[11px] text-slate-400">Unggah file CSV atau Excel di sebelah kiri</p>
                </div>
              )}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-600">
                  {isValidating
                    ? validationStage
                    : loadedFile
                    ? "Validasi struktur & isi"
                    : "Status Validasi"}
                </span>
                <span className="text-[11px] font-bold text-[#0a7ebf]">{progress}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-1.5 rounded-full bg-[#0a7ebf] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                {isValidating
                  ? validationStage
                  : loadedFile
                  ? "Pemeriksaan selesai. Data siap dipratinjau & dikomit."
                  : "Menunggu masukan berkas..."}
              </p>
            </div>
          </div>
        </div>

        {/* 4 Kartu KPI Ringkasan (Skeleton Aktif saat Loading) */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {isDisplayLoading ? (
            <>
              <KpiSkeletonCard />
              <KpiSkeletonCard />
              <KpiSkeletonCard />
              <KpiSkeletonCard />
            </>
          ) : (
            <>
              {/* TOTAL BARIS */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    TOTAL BARIS
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e0f2fe] text-[#0a7ebf]">
                    <ListChecks className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-2xl font-bold text-slate-900">
                    {kpiCounts.total.toLocaleString("id-ID")}
                  </h2>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {loadedFile ? "Terbaca dari sheet berkas" : "Menunggu berkas diunggah"}
                </p>
              </div>

              {/* VALID */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    VALID
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#dcfce7] text-[#16a34a]">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-2xl font-bold text-slate-900">
                    {kpiCounts.valid.toLocaleString("id-ID")}
                  </h2>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {kpiCounts.total > 0
                    ? `${((kpiCounts.valid / kpiCounts.total) * 100).toFixed(1).replace(".", ",")}% siap diunggah`
                    : "0% siap diunggah"}
                </p>
              </div>

              {/* INVALID */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    INVALID
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ffe4e6] text-[#e11d48]">
                    <XCircle className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-2xl font-bold text-slate-900">
                    {kpiCounts.invalid}
                  </h2>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Format atau nilai tidak sesuai
                </p>
              </div>

              {/* WARNING */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    WARNING
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fef3c7] text-[#d97706]">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-2xl font-bold text-slate-900">
                    {kpiCounts.warning}
                  </h2>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Perlu konfirmasi sebelum proses
                </p>
              </div>
            </>
          )}
        </div>

        {/* Tabel Preview Data (Skeleton Aktif saat Loading) */}
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Preview Data</h3>
              <p className="text-[11px] text-slate-400">
                Menampilkan {displayedRecords.length} dari {kpiCounts.total.toLocaleString("id-ID")} baris
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterTab("Semua")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  filterTab === "Semua"
                    ? "bg-[#e0f2fe] text-[#0a7ebf]"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Semua {kpiCounts.total.toLocaleString("id-ID")}
              </button>

              <button
                onClick={() => setFilterTab("Invalid")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  filterTab === "Invalid"
                    ? "bg-[#ffe4e6] text-[#e11d48]"
                    : "bg-rose-50/70 text-[#e11d48] hover:bg-rose-100"
                }`}
              >
                Invalid {kpiCounts.invalid}
              </button>

              <button
                onClick={() => setFilterTab("Warning")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  filterTab === "Warning"
                    ? "bg-[#fef3c7] text-[#d97706]"
                    : "bg-amber-50/70 text-[#d97706] hover:bg-amber-100"
                }`}
              >
                Warning {kpiCounts.warning}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400">
                  <th className="py-3 px-2">ID RECORD</th>
                  <th className="py-3 px-2">CUSTOMER</th>
                  <th className="py-3 px-2">KATEGORI</th>
                  <th className="py-3 px-2">NOMINAL</th>
                  <th className="py-3 px-2 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isDisplayLoading ? (
                  <>
                    <TableSkeletonRow />
                    <TableSkeletonRow />
                    <TableSkeletonRow />
                    <TableSkeletonRow />
                  </>
                ) : displayedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs text-slate-400">
                      {loadedFile
                        ? "Tidak ada data pada kategori status ini."
                        : "Belum ada data untuk dipratinjau. Silakan unggah berkas CSV atau Excel terlebih dahulu."}
                    </td>
                  </tr>
                ) : (
                  displayedRecords.slice(0, 10).map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-2 font-mono font-medium text-slate-600">
                        {row.recordId}
                      </td>
                      <td className="py-3 px-2 font-semibold text-slate-900">
                        {row.customerName}
                      </td>
                      <td className="py-3 px-2 text-slate-600">
                        {row.category}
                      </td>
                      <td className="py-3 px-2 font-medium text-slate-900">
                        {formatRupiah(row.amount)}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span
                          className={`inline-block rounded-full px-3 py-0.5 text-[11px] font-semibold ${
                            row.status === "Valid"
                              ? "bg-[#dcfce7] text-[#16a34a]"
                              : row.status === "Warning"
                              ? "bg-[#fef3c7] text-[#d97706]"
                              : "bg-[#ffe4e6] text-[#e11d48]"
                          }`}
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

          <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              {kpiCounts.invalid} baris invalid akan dilewati saat upload
            </p>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleCancel}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Batalkan
              </button>

              <button
                onClick={handleCommitData}
                disabled={isCommitting || kpiCounts.processable === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0a7ebf] px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#08689d] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCommitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-white" />
                )}
                <span>Proses {kpiCounts.processable.toLocaleString("id-ID")} Data</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}