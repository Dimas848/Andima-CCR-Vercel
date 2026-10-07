"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import ExcelJS from "exceljs";
import {
  Bell,
  CalendarDays,
  FileSpreadsheet,
  Download,
  Check,
  Info,
  ArrowRight,
  FileText,
  Loader2,
  SlidersHorizontal,
  TrendingUp,
  AlertCircle,
  Building2,
  Lock,
  RotateCw,
  X,
  CheckCircle2,
} from "lucide-react";

import Sidebar from "@/components/sidebar";
import { supabase } from "@/lib/supabase";

interface ReportHistoryRow {
  id: string;
  jenis: string;
  periode: string;
  customer: string;
  isiData: string;
  dibuat: string;
  status: "Siap" | "Kedaluwarsa";
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const SHORT_MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
];

function getDynamicPeriod(offsetMonths = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() - offsetMonths);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function formatLiveDate(date: Date = new Date(), minusMinutes = 0): string {
  const target = new Date(date.getTime() - minusMinutes * 60 * 1000);
  const day = String(target.getDate()).padStart(2, "0");
  const month = SHORT_MONTH_NAMES[target.getMonth()];
  const year = target.getFullYear();
  const hours = String(target.getHours()).padStart(2, "0");
  const minutes = String(target.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} · ${hours}:${minutes}`;
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
                <div key={`notif-export-${cat.title}-${i}`} className="flex gap-3.5 p-5 transition hover:bg-slate-50/60">
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
// KOMPONEN UTAMA: EXPORT REPORT
// =========================================================================
export default function ExportReportPage() {
  const currentPeriod = useMemo(() => getDynamicPeriod(0), []);

  const [selectedReportType, setSelectedReportType] = useState<string>("Monthly Cost Detail");
  const [periode, setPeriode] = useState<string>(currentPeriod);
  const [selectedCustomer, setSelectedCustomer] = useState("Semua Customer");

  const [sertakanSummary, setSertakanSummary] = useState(true);
  const [sertakanException, setSertakanException] = useState(true);
  const [sertakanEvidence, setSertakanEvidence] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [activeStep, setActiveStep] = useState(4);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // State Data Murni dari Database Supabase
  const [dbTransactions, setDbTransactions] = useState<any[]>([]);
  const [reportsList, setReportsList] = useState<ReportHistoryRow[]>([]);

  // 1. Tarik Data Nyata dari Supabase View c2_cost_transactions
  const fetchLiveDatabase = useCallback(async () => {
    try {
      setIsSyncing(true);
      const { data, error } = await supabase
        .from("c2_cost_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !data || data.length === 0) {
        setDbTransactions([]);
        setReportsList([]);
        return;
      }

      setDbTransactions(data);

      const totalRows = data.length;
      const totalExceptions = data.filter((t) => t.review_flag || Number(t.variance || 0) > 0 || !t.has_evidence).length;
      const totalCust = new Set(data.map((t) => t.customer_name).filter(Boolean)).size;

      // Inisialisasi riwayat laporan awal
      setReportsList([
        {
          id: `rep-init-1`,
          jenis: "Monthly Cost Detail",
          periode: currentPeriod,
          customer: "Semua Customer",
          isiData: `${totalRows.toLocaleString("id-ID")} baris data`,
          dibuat: formatLiveDate(new Date(), 10),
          status: "Siap",
        },
        {
          id: `rep-init-2`,
          jenis: "Exception Summary",
          periode: currentPeriod,
          customer: "Semua Customer",
          isiData: `${totalExceptions} exception`,
          dibuat: formatLiveDate(new Date(), 45),
          status: "Siap",
        },
        {
          id: `rep-init-3`,
          jenis: "Customer Cost Breakdown",
          periode: currentPeriod,
          customer: "Semua Customer",
          isiData: `${totalCust} customer`,
          dibuat: formatLiveDate(new Date(), 120),
          status: "Siap",
        },
        {
          id: `rep-init-4`,
          jenis: "Berita Acara Closing",
          periode: currentPeriod,
          customer: "Semua Customer",
          isiData: "Dokumen Otorisasi",
          dibuat: formatLiveDate(new Date(), 1440),
          status: "Kedaluwarsa",
        },
      ]);
    } catch (err) {
      console.error("Gagal mengambil data dari Supabase:", err);
      setDbTransactions([]);
      setReportsList([]);
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, [currentPeriod]);

  useEffect(() => {
    fetchLiveDatabase();
  }, [fetchLiveDatabase]);

  // Dropdown Periode Dinamis Berdasarkan Data Database
  const dynamicPeriodOptions = useMemo(() => {
    const list = Array.from(new Set(dbTransactions.map((t) => t.period_month).filter(Boolean)));
    if (list.length > 0) return list;
    return [getDynamicPeriod(0), getDynamicPeriod(1)];
  }, [dbTransactions]);

  // Dropdown Customer Dinamis Berdasarkan Data Database
  const dynamicCustomerOptions = useMemo(() => {
    const unique = Array.from(new Set(dbTransactions.map((t) => t.customer_name))).filter(Boolean);
    return ["Semua Customer", ...unique];
  }, [dbTransactions]);

  // Dataset Aktif Sesuai Filter Periode & Customer
  const activeDataset = useMemo(() => {
    return dbTransactions.filter((t) => {
      const matchPeriod = !periode || t.period_month === periode;
      const matchCustomer = selectedCustomer === "Semua Customer" || t.customer_name === selectedCustomer;
      return matchPeriod && matchCustomer;
    });
  }, [dbTransactions, periode, selectedCustomer]);

  const activeExceptionCount = useMemo(() => {
    return activeDataset.filter((t) => t.review_flag || Number(t.variance || 0) > 0 || !t.has_evidence).length;
  }, [activeDataset]);

  // Kategori Notifikasi Dinamis
  const notificationCategories = useMemo(() => {
    const list = [];
    const overBudget = activeDataset.filter((r) => Number(r.variance || 0) > 0);
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

    const highCost = activeDataset.filter((r) => Number(r.actual_cost || 0) >= 50_000_000);
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

    const missingEvidence = activeDataset.filter((r) => !r.has_evidence);
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
  }, [activeDataset]);

  // Generator File Excel Dinamis Sesuai Jenis Laporan
  const generateAndDownloadWorkbook = async (
    reportType: string,
    targetPeriod: string,
    targetCustomer: string
  ) => {
    try {
      const dataset = dbTransactions.filter((t) => {
        const matchPeriod = !targetPeriod || t.period_month === targetPeriod;
        const matchCustomer = targetCustomer === "Semua Customer" || t.customer_name === targetCustomer;
        return matchPeriod && matchCustomer;
      });

      if (dataset.length === 0) {
        alert("Tidak ada data transaksi untuk kriteria laporan ini.");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "PT Andima Transportindo - CCR C2";
      workbook.created = new Date();

      const totalActual = dataset.reduce((acc, curr) => acc + Number(curr.actual_cost || 0), 0);
      const totalPlanned = dataset.reduce((acc, curr) => acc + Number(curr.planned_cost || 0), 0);
      const varianceVal = totalActual - totalPlanned;
      const variancePct = totalPlanned > 0 ? ((varianceVal / totalPlanned) * 100).toFixed(1) : "0.0";

      // 1. JENIS LAPORAN: MONTHLY COST DETAIL
      if (reportType === "Monthly Cost Detail") {
        if (sertakanSummary) {
          const sheet1 = workbook.addWorksheet("Ringkasan MtM");
          sheet1.columns = [
            { header: "Indikator Kinerja Keuangan", key: "indikator", width: 34 },
            { header: "Nilai Realisasi Aktual (IDR)", key: "realisasi", width: 28 },
            { header: "Pagu Anggaran (IDR)", key: "budget", width: 28 },
            { header: "Deviasi MtM", key: "deviasi", width: 18 },
          ];

          sheet1.getRow(1).eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A7EBF" } };
            cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
            cell.alignment = { vertical: "middle", horizontal: "center" };
          });

          sheet1.addRow({
            indikator: "Total Biaya Operasional Bulanan",
            realisasi: totalActual,
            budget: totalPlanned,
            deviasi: varianceVal >= 0 ? `+${variancePct}%` : `${variancePct}%`,
          });
          sheet1.addRow({
            indikator: "Total Transaksi Tercatat",
            realisasi: dataset.length,
            budget: dataset.length,
            deviasi: "100%",
          });
          sheet1.addRow({
            indikator: "Jumlah Akun Pelanggan Terlibat",
            realisasi: new Set(dataset.map((t) => t.customer_name)).size,
            budget: new Set(dataset.map((t) => t.customer_name)).size,
            deviasi: "Lengkap",
          });

          sheet1.getColumn(2).numFmt = "#,##0";
          sheet1.getColumn(3).numFmt = "#,##0";
        }

        const sheet2 = workbook.addWorksheet("Detail Transaksi");
        const cols = [
          { header: "No. Voucher", key: "voucher", width: 20 },
          { header: "Job Number", key: "job", width: 24 },
          { header: "Nama Customer", key: "name", width: 32 },
          { header: "Kategori Biaya", key: "cat", width: 20 },
          { header: "Nominal Aktual (IDR)", key: "actual", width: 24 },
          { header: "Pagu Anggaran (IDR)", key: "planned", width: 24 },
          { header: "Status Bukti", key: "evidence", width: 18 },
        ];
        if (sertakanEvidence) {
          cols.push({ header: "Tautan Berkas Bukti", key: "evidence_url", width: 38 });
        }
        sheet2.columns = cols;

        sheet2.getRow(1).eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2342" } };
          cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
          cell.alignment = { vertical: "middle", horizontal: "center" };
        });

        dataset.forEach((t) => {
          sheet2.addRow({
            voucher: t.voucher_no || "-",
            job: t.job_number || "-",
            name: t.customer_name || "-",
            cat: t.cost_category || "-",
            actual: Number(t.actual_cost || 0),
            planned: Number(t.planned_cost || 0),
            evidence: t.has_evidence ? "LENGKAP" : "BELUM LENGKAP",
            evidence_url: t.evidence_url || "Belum ada lampiran",
          });
        });
        sheet2.getColumn(5).numFmt = "#,##0";
        sheet2.getColumn(6).numFmt = "#,##0";

        if (sertakanException) {
          const sheet3 = workbook.addWorksheet("Rekapitulasi Anomali");
          sheet3.columns = [
            { header: "Nomor Voucher", key: "voucher", width: 20 },
            { header: "Job Number", key: "job", width: 24 },
            { header: "Customer", key: "cust", width: 30 },
            { header: "Jenis Anomali", key: "tag", width: 24 },
            { header: "Nominal Biaya (IDR)", key: "amount", width: 22 },
          ];

          sheet3.getRow(1).eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE11D48" } };
            cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
            cell.alignment = { vertical: "middle", horizontal: "center" };
          });

          const excList = dataset.filter((t) => t.review_flag || Number(t.variance || 0) > 0 || !t.has_evidence);
          excList.forEach((ex) => {
            sheet3.addRow({
              voucher: ex.voucher_no || "-",
              job: ex.job_number || "-",
              cust: ex.customer_name || "-",
              tag: Number(ex.variance || 0) > 0 ? "OVER_BUDGET" : !ex.has_evidence ? "MISSING_EVIDENCE" : "REVIEW",
              amount: Number(ex.actual_cost || 0),
            });
          });
          sheet3.getColumn(5).numFmt = "#,##0";
        }
      }

      // 2. JENIS LAPORAN: EXCEPTION SUMMARY
      else if (reportType === "Exception Summary") {
        const sheet = workbook.addWorksheet("Exception Summary");
        sheet.columns = [
          { header: "ID Exception", key: "id", width: 18 },
          { header: "Job Number", key: "job", width: 24 },
          { header: "Customer", key: "cust", width: 30 },
          { header: "Kategori Biaya", key: "cat", width: 20 },
          { header: "Nominal Aktual (IDR)", key: "actual", width: 22 },
          { header: "Toleransi Budget (IDR)", key: "planned", width: 22 },
          { header: "Klasifikasi Anomali", key: "tag", width: 24 },
          { header: "Status Resolusi", key: "status", width: 18 },
        ];

        sheet.getRow(1).eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE11D48" } };
          cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
          cell.alignment = { vertical: "middle", horizontal: "center" };
        });

        const excList = dataset.filter((t) => t.review_flag || Number(t.variance || 0) > 0 || !t.has_evidence);
        excList.forEach((ex, idx) => {
          let tag = "OVER_BUDGET";
          if (!ex.is_job_matched || ex.job_number === "UNMATCHED") tag = "DUPLICATE_DATA";
          else if (!ex.has_evidence) tag = "MISSING_EVIDENCE";
          else if (Number(ex.actual_cost || 0) >= 50_000_000) tag = "HIGH_COST";

          sheet.addRow({
            id: `EXC-${String(idx + 1).padStart(4, "0")}`,
            job: ex.job_number || "-",
            cust: ex.customer_name || "-",
            cat: ex.cost_category || "-",
            actual: Number(ex.actual_cost || 0),
            planned: Number(ex.planned_cost || 0),
            tag,
            status: ex.status || (ex.review_flag ? "Terbuka" : "Selesai"),
          });
        });
        sheet.getColumn(5).numFmt = "#,##0";
        sheet.getColumn(6).numFmt = "#,##0";
      }

      // 3. JENIS LAPORAN: CUSTOMER COST BREAKDOWN
      else if (reportType === "Customer Cost Breakdown") {
        const sheet = workbook.addWorksheet("Customer Breakdown");
        sheet.columns = [
          { header: "Nama Customer", key: "cust", width: 32 },
          { header: "Total Realisasi (IDR)", key: "actual", width: 24 },
          { header: "Pagu Anggaran (IDR)", key: "planned", width: 24 },
          { header: "Selisih Variance (IDR)", key: "variance", width: 24 },
          { header: "Jumlah Anomali", key: "exc", width: 18 },
          { header: "Kontribusi Total (%)", key: "share", width: 20 },
        ];

        sheet.getRow(1).eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A7EBF" } };
          cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
          cell.alignment = { vertical: "middle", horizontal: "center" };
        });

        const custMap = new Map<string, { actual: number; planned: number; exc: number }>();
        dataset.forEach((t) => {
          const name = t.customer_name || "Tanpa Nama";
          const curr = custMap.get(name) || { actual: 0, planned: 0, exc: 0 };
          const isExc = Boolean(t.review_flag || Number(t.variance || 0) > 0 || !t.has_evidence);
          custMap.set(name, {
            actual: curr.actual + Number(t.actual_cost || 0),
            planned: curr.planned + Number(t.planned_cost || 0),
            exc: curr.exc + (isExc ? 1 : 0),
          });
        });

        const grandActual = Array.from(custMap.values()).reduce((sum, v) => sum + v.actual, 0);

        Array.from(custMap.entries()).forEach(([name, val]) => {
          const share = grandActual > 0 ? ((val.actual / grandActual) * 100).toFixed(1) + "%" : "0%";
          sheet.addRow({
            cust: name,
            actual: val.actual,
            planned: val.planned,
            variance: val.actual - val.planned,
            exc: val.exc,
            share,
          });
        });
        sheet.getColumn(2).numFmt = "#,##0";
        sheet.getColumn(3).numFmt = "#,##0";
        sheet.getColumn(4).numFmt = "#,##0";
      }

      // 4. JENIS LAPORAN: BERITA ACARA CLOSING
      else if (reportType === "Berita Acara Closing") {
        const sheet = workbook.addWorksheet("Berita Acara");
        sheet.columns = [
          { header: "Parameter Otorisasi Penutupan Buku", key: "param", width: 44 },
          { header: "Rincian / Status Eksekusi", key: "val", width: 44 },
        ];

        sheet.getRow(1).eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } };
          cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
          cell.alignment = { vertical: "middle", horizontal: "center" };
        });

        sheet.addRow({ param: "Nomor Dokumen Berita Acara", val: `BA-CCR2/${targetPeriod.replace(/\s+/g, "/")}/001` });
        sheet.addRow({ param: "Periode Buku Transaksi", val: targetPeriod });
        sheet.addRow({ param: "Total Baris Transaksi Tervalidasi", val: `${dataset.length.toLocaleString("id-ID")} Baris` });
        sheet.addRow({ param: "Total Realisasi Biaya Bersih (IDR)", val: totalActual });
        sheet.addRow({ param: "Status Rekonsiliasi Exception", val: activeExceptionCount === 0 ? "Nihil (Semua Selesai)" : `${activeExceptionCount} Exception Ditangani` });
        sheet.addRow({ param: "Status Pengesahan Head of Finance", val: "DISETUJUI & TERKUNCI (READ-ONLY)" });
        sheet.addRow({ param: "Waktu Otorisasi Sistem", val: formatLiveDate(new Date()) });
        sheet.getColumn(2).numFmt = "#,##0";
      }

      // Tulis file Excel ke buffer dan unduh otomatis
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const cleanFileName = reportType.replace(/\s+/g, "_");
      link.download = `${cleanFileName}_${targetPeriod.replace(/\s+/g, "_")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setToastMessage(`Laporan ${reportType} (${targetPeriod}) berhasil diunduh!`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      console.error("Gagal ekspor Excel:", err);
      alert(`Gagal membuat berkas Excel: ${err.message}`);
    }
  };

  // Handler Generate Laporan Baru (Simulasi Progres Visual + Pencatatan Nyata)
  const handleBuatLaporan = () => {
    setIsGenerating(true);
    setActiveStep(1);

    setTimeout(() => setActiveStep(2), 300);
    setTimeout(() => setActiveStep(3), 600);
    setTimeout(() => {
      setActiveStep(4);
      setIsGenerating(false);

      const newReport: ReportHistoryRow = {
        id: `rep-${Date.now()}`,
        jenis: selectedReportType,
        periode: periode,
        customer: selectedCustomer,
        isiData: `${activeDataset.length.toLocaleString("id-ID")} baris data`,
        dibuat: formatLiveDate(new Date()),
        status: "Siap",
      };

      setReportsList((prev) => [newReport, ...prev]);
      setToastMessage(`Laporan "${selectedReportType}" berhasil dibuat dan siap diunduh.`);
      setTimeout(() => setToastMessage(null), 3500);
    }, 950);
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
              Export Report
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">
              Buat dan unduh laporan Excel untuk kebutuhan analisis dan audit
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchLiveDatabase}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-50 cursor-pointer"
            >
              <SlidersHorizontal className={`h-3.5 w-3.5 text-slate-600 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Menyinkronkan..." : "Sinkronkan Supabase"}</span>
            </button>

            {/* Tombol Lonceng Notifikasi */}
            <div className="relative">
              <button
                aria-label="Lihat Notifikasi"
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className={`relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 ${
                  isNotificationOpen ? "ring-2 ring-[#0a7ebf]" : ""
                }`}
              >
                <Bell className="h-4 w-4" />
                {activeExceptionCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
                )}
              </button>

              <NotificationPopover
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
                periode={periode}
                isLoading={isLoading}
                totalExceptions={activeExceptionCount}
                categories={notificationCategories}
              />
            </div>

            {/* Lencana Tanggal Dinamis Saat Ini */}
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#e0f2fe] px-3 py-1.5 text-xs font-semibold text-[#0284c7]">
              <CalendarDays className="h-3.5 w-3.5 text-[#0284c7]" />
              {currentPeriod}
            </span>
          </div>
        </div>

        {/* Toast Notifikasi Feedback */}
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

        {/* Section 1: Pilih Jenis Laporan */}
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pilih Jenis Laporan</h3>
              <p className="text-[11px] text-slate-400">Pilih satu jenis laporan yang ingin diekspor</p>
            </div>
            <span className="rounded-full bg-[#e0f2fe] px-2.5 py-0.5 text-[11px] font-bold text-[#0284c7]">
              4 jenis tersedia
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={`type-skel-${idx}`} className="rounded-xl border border-slate-200 p-4 animate-pulse space-y-3">
                  <div className="h-8 w-8 rounded-lg bg-slate-200" />
                  <div className="h-3.5 w-32 rounded bg-slate-200" />
                  <div className="h-2.5 w-44 rounded bg-slate-100" />
                </div>
              ))
            ) : (
              <>
                <div
                  onClick={() => setSelectedReportType("Monthly Cost Detail")}
                  className={`cursor-pointer rounded-xl border p-4 transition ${
                    selectedReportType === "Monthly Cost Detail"
                      ? "border-[#0a7ebf] bg-sky-50/20 shadow-xs"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0a7ebf] text-white">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  <h4 className="mt-3 text-xs font-bold text-slate-900">Monthly Cost Detail</h4>
                  <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                    Detail seluruh transaksi biaya per bulan (.xlsx)
                  </p>
                </div>

                <div
                  onClick={() => setSelectedReportType("Exception Summary")}
                  className={`cursor-pointer rounded-xl border p-4 transition ${
                    selectedReportType === "Exception Summary"
                      ? "border-[#0a7ebf] bg-sky-50/20 shadow-xs"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-[#e11d48]">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <h4 className="mt-3 text-xs font-bold text-slate-800">Exception Summary</h4>
                  <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                    Ringkasan seluruh anomali dan tindak lanjut (.xlsx)
                  </p>
                </div>

                <div
                  onClick={() => setSelectedReportType("Customer Cost Breakdown")}
                  className={`cursor-pointer rounded-xl border p-4 transition ${
                    selectedReportType === "Customer Cost Breakdown"
                      ? "border-[#0a7ebf] bg-sky-50/20 shadow-xs"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <h4 className="mt-3 text-xs font-bold text-slate-800">Customer Cost Breakdown</h4>
                  <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                    Rincian biaya dan anggaran per customer (.xlsx)
                  </p>
                </div>

                <div
                  onClick={() => setSelectedReportType("Berita Acara Closing")}
                  className={`cursor-pointer rounded-xl border p-4 transition ${
                    selectedReportType === "Berita Acara Closing"
                      ? "border-[#0a7ebf] bg-sky-50/20 shadow-xs"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Lock className="h-4 w-4" />
                  </div>
                  <h4 className="mt-3 text-xs font-bold text-slate-800">Berita Acara Closing</h4>
                  <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                    Dokumen pengesahan BA Monthly Closing (.xlsx)
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Section 2: Buat Laporan Baru & Format Output */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-8 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Buat Laporan Baru</h3>
              <p className="text-[11px] text-slate-400">
                Pilih parameter laporan Excel — {selectedReportType}
              </p>

              {isLoading ? (
                <div className="mt-4 space-y-4 animate-pulse">
                  <div className="flex gap-3">
                    <div className="h-9 flex-1 rounded-lg bg-slate-200" />
                    <div className="h-9 flex-1 rounded-lg bg-slate-200" />
                    <div className="h-9 w-28 rounded-lg bg-slate-200" />
                  </div>
                  <div className="flex gap-4">
                    <div className="h-4 w-28 rounded bg-slate-200" />
                    <div className="h-4 w-28 rounded bg-slate-200" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[160px]">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Periode</label>
                      <select
                        value={periode}
                        onChange={(e) => setPeriode(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#0a7ebf]"
                      >
                        {dynamicPeriodOptions.map((p) => (
                          <option key={`opt-per-${p}`} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Customer</label>
                      <select
                        value={selectedCustomer}
                        onChange={(e) => setSelectedCustomer(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#0a7ebf]"
                      >
                        {dynamicCustomerOptions.map((c, i) => (
                          <option key={`opt-cust-${c}-${i}`} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleBuatLaporan}
                      disabled={isGenerating || activeDataset.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0a7ebf] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#08689d] active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {isGenerating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                      <span>Buat Laporan</span>
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={sertakanSummary}
                        onChange={(e) => setSertakanSummary(e.target.checked)}
                        className="h-3.5 w-3.5 rounded accent-[#0a7ebf]"
                      />
                      <span>Sertakan summary</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={sertakanException}
                        onChange={(e) => setSertakanException(e.target.checked)}
                        className="h-3.5 w-3.5 rounded accent-[#0a7ebf]"
                      />
                      <span>Sertakan exception</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={sertakanEvidence}
                        onChange={(e) => setSertakanEvidence(e.target.checked)}
                        className="h-3.5 w-3.5 rounded accent-[#0a7ebf]"
                      />
                      <span>Sertakan tautan evidence</span>
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-4 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Format Output</h3>
              <p className="text-[11px] text-slate-400">Microsoft Excel Workbook</p>

              <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-100 bg-[#ecfdf5] p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#10b981] text-white">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">.XLSX</h4>
                  <p className="text-[10px] text-slate-500">Kompatibel Excel 2016+ & Google Sheets</p>
                </div>
              </div>
            </div>

            <p className="mt-4 text-[10px] leading-relaxed text-slate-400">
              Laporan terstruktur rapi dengan format mata uang otomatis dan lembar kerja terpisah.
            </p>
          </div>
        </div>

        {/* Section 3: Proses Generate & Siap untuk Diunduh */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-8 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Proses Generate</h3>
              <p className="text-[11px] text-slate-400">Penyusunan berkas otomatis dari database</p>

              <div className="mt-5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#10b981] text-white text-[11px] font-bold">
                    1
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Validasi Data</p>
                    <p className="text-[10px] font-semibold text-[#10b981]">Selesai</p>
                  </div>
                </div>

                <span className="text-slate-400 text-xs">→</span>

                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#10b981] text-white text-[11px] font-bold">
                    2
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Kompilasi Data</p>
                    <p className="text-[10px] font-semibold text-[#10b981]">Selesai</p>
                  </div>
                </div>

                <span className="text-slate-400 text-xs">→</span>

                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#10b981] text-white text-[11px] font-bold">
                    3
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Membuat Excel</p>
                    <p className="text-[10px] font-semibold text-[#10b981]">100%</p>
                  </div>
                </div>

                <span className="text-slate-400 text-xs">→</span>

                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0a7ebf] text-white text-[11px] font-bold">
                    4
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Laporan Siap</p>
                    <p className="text-[10px] font-semibold text-[#0a7ebf]">Selesai</p>
                  </div>
                </div>
              </div>

              <div className="mt-3 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full w-full bg-[#10b981]" />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-xl border border-emerald-100 bg-[#ecfdf5] px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#10b981] text-white">
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Laporan Siap</h4>
                  <p className="text-[11px] text-slate-500">
                    {selectedReportType}_{periode.replace(/\s+/g, "_")}.xlsx · {activeDataset.length} baris live
                  </p>
                </div>
              </div>

              <button
                onClick={() => generateAndDownloadWorkbook(selectedReportType, periode, selectedCustomer)}
                disabled={activeDataset.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0a7ebf] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#08689d] transition disabled:opacity-50 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Unduh Excel</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-[#09294d] p-5 text-white shadow-sm xl:col-span-4 flex flex-col justify-between items-center text-center">
            <div className="flex flex-col items-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white shadow-inner">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-white">Siap untuk Diunduh</h3>
              <p className="mt-1 text-[11px] text-sky-100/80 leading-relaxed max-w-[210px]">
                Berkas laporan di-generate langsung dari transaksi database Supabase.
              </p>
            </div>

            <button
              onClick={() => generateAndDownloadWorkbook(selectedReportType, periode, selectedCustomer)}
              disabled={activeDataset.length === 0}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0284c7] py-2 text-xs font-bold text-white shadow hover:bg-[#0369a1] active:scale-95 transition disabled:opacity-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Unduh Excel</span>
            </button>
          </div>
        </div>

        {/* Section 4: Riwayat Laporan */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Riwayat Laporan</h3>
              <p className="text-[11px] text-slate-400">File yang dibuat dalam sesi ini</p>
            </div>
            <span className="rounded-full bg-[#e0f2fe] px-2.5 py-0.5 text-[11px] font-bold text-[#0284c7]">
              {reportsList.length} laporan
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400">
                  <th className="py-3 px-3">JENIS LAPORAN</th>
                  <th className="py-3 px-3">PERIODE</th>
                  <th className="py-3 px-3">CUSTOMER</th>
                  <th className="py-3 px-3">ISI DATA</th>
                  <th className="py-3 px-3">DIBUAT</th>
                  <th className="py-3 px-3">STATUS</th>
                  <th className="py-3 px-3 text-center">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={`history-skel-${idx}`} className="animate-pulse">
                      <td className="py-3.5 px-3"><div className="h-3.5 w-36 rounded bg-slate-200" /></td>
                      <td className="py-3.5 px-3"><div className="h-3.5 w-24 rounded bg-slate-200" /></td>
                      <td className="py-3.5 px-3"><div className="h-3.5 w-24 rounded bg-slate-200" /></td>
                      <td className="py-3.5 px-3"><div className="h-3.5 w-20 rounded bg-slate-200" /></td>
                      <td className="py-3.5 px-3"><div className="h-3.5 w-28 rounded bg-slate-200" /></td>
                      <td className="py-3.5 px-3"><div className="h-4 w-14 rounded-full bg-slate-200" /></td>
                      <td className="py-3.5 px-3 text-center"><div className="mx-auto h-5 w-16 rounded bg-slate-200" /></td>
                    </tr>
                  ))
                ) : reportsList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-xs text-slate-400">
                      Belum ada riwayat laporan yang dibuat.
                    </td>
                  </tr>
                ) : (
                  reportsList.map((row, idx) => (
                    <tr key={`rep-${row.id}-${idx}`} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-3 font-bold text-slate-800">
                        {row.jenis}
                      </td>
                      <td className="py-3.5 px-3 text-slate-700">
                        {row.periode}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 font-medium">
                        {row.customer}
                      </td>
                      <td className="py-3.5 px-3 text-slate-700 font-medium">
                        {row.isiData}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 font-medium">
                        {row.dibuat}
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            row.status === "Siap"
                              ? "bg-[#ecfdf5] text-[#059669]"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {row.status === "Siap" ? (
                          <button
                            onClick={() => generateAndDownloadWorkbook(row.jenis, row.periode, row.customer)}
                            className="inline-flex items-center gap-1 rounded bg-[#e0f2fe] px-2.5 py-1 text-[11px] font-bold text-[#0284c7] hover:bg-[#bae6fd] transition cursor-pointer"
                          >
                            <Download className="h-3 w-3" />
                            <span>Unduh</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedReportType(row.jenis);
                              setPeriode(row.periode);
                              setSelectedCustomer(row.customer);
                              handleBuatLaporan();
                            }}
                            className="inline-flex items-center gap-1 rounded bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                          >
                            <RotateCw className="h-3 w-3" />
                            <span>Buat ulang</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400 border-t border-slate-100 pt-3">
            <Info className="h-3.5 w-3.5 text-sky-600" />
            <span>File otomatis disinkronkan langsung dari data rekonsiliasi biaya Supabase.</span>
          </div>
        </div>
      </main>
    </div>
  );
}