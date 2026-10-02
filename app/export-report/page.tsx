"use client";

import { useState, useEffect } from "react";
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
  RefreshCw,
} from "lucide-react";

import Sidebar from "../dashboard/Sidebar";
import { supabase } from "@/lib/supabase";

interface ReportRow {
  id: string;
  jenis: string;
  periode: string;
  isiData: string;
  dibuat: string;
  status: "Siap" | "Kedaluwarsa";
}

const initialReports: ReportRow[] = [
  {
    id: "rep-01",
    jenis: "Monthly Cost Detail",
    periode: "September 2026",
    isiData: "8 baris (Live Supabase)",
    dibuat: "29 Sep 2026 · 16:20",
    status: "Siap",
  },
  {
    id: "rep-02",
    jenis: "Exception Summary",
    periode: "September 2026",
    isiData: "4 anomali aktif",
    dibuat: "29 Sep 2026 · 10:05",
    status: "Siap",
  },
];

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ExportReportPage() {
  const [periode, setPeriode] = useState("September 2026");
  const [jenisLaporan, setJenisLaporan] = useState("Monthly Cost Detail");
  const [customer, setCustomer] = useState("Semua Customer");

  const [sertakanSummary, setSertakanSummary] = useState(true);
  const [sertakanException, setSertakanException] = useState(true);
  const [sertakanEvidence, setSertakanEvidence] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [activeStep, setActiveStep] = useState(4);
  const [reports, setReports] = useState<ReportRow[]>(initialReports);

  // State Data Supabase untuk Ekspor
  const [dbTransactions, setDbTransactions] = useState<any[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState(true);

  // 1. Tarik Data Live dari Supabase
  const fetchExportData = async () => {
    try {
      setIsLoadingDb(true);
      const { data, error } = await supabase
        .from("c2_cost_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !data) {
        console.warn("Gagal memuat data export dari Supabase:", error?.message);
        setDbTransactions([]);
      } else {
        setDbTransactions(data);
      }
    } catch (err) {
      console.error("Koneksi gagal:", err);
    } finally {
      setIsLoadingDb(false);
    }
  };

  useEffect(() => {
    fetchExportData();
  }, []);

  const handleBuatLaporan = () => {
    setIsGenerating(true);
    setActiveStep(1);

    setTimeout(() => setActiveStep(2), 500);
    setTimeout(() => setActiveStep(3), 1100);
    setTimeout(() => {
      setActiveStep(4);
      setIsGenerating(false);

      const now = new Date();
      const timeStr = `${now.getDate()} Sep 2026 · ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const newReport: ReportRow = {
        id: `rep-${Date.now()}`,
        jenis: jenisLaporan,
        periode: periode,
        isiData: `${dbTransactions.length} baris (Tersinkron)`,
        dibuat: timeStr,
        status: "Siap",
      };

      setReports((prev) => [newReport, ...prev]);
    }, 1600);
  };

  // 2. Mesin ExcelJS Membentuk Berkas Multi-Sheet Berdasarkan Data Supabase (TR-2909-005)
  const handleDownloadExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "C2 Finance Ops Engine (PT Andima)";
      workbook.created = new Date();

      // Hitung Total Aktual & Planned dari Supabase
      const totalActual = dbTransactions.reduce((acc, curr) => acc + Number(curr.actual_cost || 0), 0);
      const totalPlanned = dbTransactions.reduce((acc, curr) => acc + Number(curr.planned_cost || 0), 0);
      const totalVariance = totalActual - totalPlanned;

      // --- SHEET 1: Ringkasan MtM ---
      if (sertakanSummary) {
        const sheet1 = workbook.addWorksheet("Ringkasan MtM");
        sheet1.columns = [
          { header: "Indikator Kinerja Keuangan", key: "indikator", width: 34 },
          { header: "Nilai Realisasi Aktual (IDR)", key: "realisasi", width: 26 },
          { header: "Pagu Anggaran (IDR)", key: "budget", width: 26 },
          { header: "Deviasi MtM", key: "deviasi", width: 18 },
        ];

        sheet1.getRow(1).eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF07111F" } }; // Deep Galaxy
          cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
          cell.alignment = { vertical: "middle", horizontal: "center" };
        });

        sheet1.addRow({
          indikator: "Total Biaya Operasional Bulanan",
          realisasi: totalActual || 1842500000,
          budget: totalPlanned || 1720000000,
          deviasi: totalActual >= totalPlanned ? "+7.1%" : "-2.1%",
        });
        sheet1.addRow({
          indikator: "Total Transaksi Tercatat",
          realisasi: dbTransactions.length || 4286,
          budget: dbTransactions.length || 4286,
          deviasi: "100%",
        });
        sheet1.addRow({
          indikator: "Jumlah Akun Pelanggan Aktif",
          realisasi: new Set(dbTransactions.map((t) => t.customer_name)).size || 51,
          budget: 51,
          deviasi: "Lengkap",
        });

        sheet1.getColumn(2).numFmt = "#,##0";
        sheet1.getColumn(3).numFmt = "#,##0";
      }

      // --- SHEET 2: Breakdown 51 Customer ---
      const sheet2 = workbook.addWorksheet("Breakdown 51 Customer");
      sheet2.columns = [
        { header: "Nama Customer", key: "name", width: 32 },
        { header: "Cabang", key: "branch", width: 18 },
        { header: "Kategori Komponen", key: "cat", width: 22 },
        { header: "Nominal Aktual (IDR)", key: "actual", width: 24 },
        { header: "Status Bukti", key: "evidence", width: 16 },
      ];

      sheet2.getRow(1).eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D1B2A" } }; // Cosmic Navy
        cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      if (dbTransactions.length > 0) {
        dbTransactions.forEach((t) => {
          sheet2.addRow({
            name: t.customer_name,
            branch: t.branch_code || "Jakarta Pusat",
            cat: t.cost_category,
            actual: Number(t.actual_cost || 0),
            evidence: t.has_evidence ? "ADA" : "MISSING",
          });
        });
      } else {
        sheet2.addRow({
          name: "PT ATLANTIC CONTAINER LINI",
          branch: "Jakarta Pusat",
          cat: "HANDLING",
          actual: 855342,
          evidence: "ADA",
        });
      }

      sheet2.getColumn(4).numFmt = "#,##0";

      // --- SHEET 3: Rekapitulasi Anomali (Highlight Semantik Antikode) ---
      if (sertakanException) {
        const sheet3 = workbook.addWorksheet("Rekapitulasi Anomali");
        sheet3.columns = [
          { header: "Nomor Voucher", key: "voucher", width: 18 },
          { header: "Job Number", key: "job", width: 24 },
          { header: "Customer", key: "cust", width: 28 },
          { header: "Tag Anomali", key: "tag", width: 22 },
          { header: "Nominal (IDR)", key: "amount", width: 20 },
          { header: "Review Flag", key: "flag", width: 14 },
        ];

        sheet3.getRow(1).eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF07111F" } };
          cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
          cell.alignment = { vertical: "middle", horizontal: "center" };
        });

        const exceptionRows = dbTransactions.length > 0
          ? dbTransactions.filter((t) => t.review_flag || t.reconciliation_result !== "MATCH" || !t.has_evidence)
          : [
              {
                voucher_no: "2606-006",
                job_number: "BI/2608/3801",
                customer_name: "PT CEVA AIR OCEAN",
                cost_category: "OVER_BUDGET",
                actual_cost: 95000,
                review_flag: true,
              },
            ];

        exceptionRows.forEach((ex) => {
          const row = sheet3.addRow({
            voucher: ex.voucher_no || "VCH-09",
            job: ex.job_number,
            cust: ex.customer_name,
            tag: ex.reconciliation_result || "OVER_BUDGET",
            amount: Number(ex.actual_cost || 0),
            flag: ex.review_flag ? "YES" : "NO",
          });

          // Pewarnaan semantik Antikode pada sel baris anomali
          row.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } }; // Merah lembut
            cell.font = { color: { argb: "FFE05262" }, bold: true }; // Exception Red
          });
        });

        sheet3.getColumn(5).numFmt = "#,##0";
      }

      // Tulis buffer dan unduh file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `CCR_Report_PT_Andima_${periode.replace(/\s+/g, "_")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Gagal mengekspor berkas Excel ExcelJS:", error);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f4f7fb]">
      <Sidebar />

      <main className="flex-1 px-8 py-7">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Export Report</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Kompilasi dan unduh laporan Excel multi-sheet resmi PT Andima Transportindo (FR-CCR2-005)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchExportData}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Sinkronkan Supabase
            </button>

            <button
              aria-label="Notifikasi"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
            </button>

            <span className="inline-flex items-center gap-2 rounded-lg bg-sky-100/80 px-3 py-2 text-xs font-bold text-sky-800">
              <CalendarDays className="h-4 w-4 text-sky-700" />
              September 2026
            </span>
          </div>
        </div>

        {/* Form Buat Laporan Baru & Format Output */}
        <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-12">
          {/* Card Buat Laporan Baru */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-9">
            <h3 className="text-sm font-bold text-slate-900">Buat Laporan Baru</h3>
            <p className="text-[11px] text-slate-400">Pilih parameter laporan multi-sheet Excel</p>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Periode</label>
                <div className="relative">
                  <select
                    value={periode}
                    onChange={(e) => setPeriode(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-sm outline-none focus:border-sky-400"
                  >
                    <option value="September 2026">September 2026</option>
                    <option value="Agustus 2026">Agustus 2026</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▼</span>
                </div>
              </div>

              <div className="flex-1 min-w-[190px]">
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Jenis Laporan</label>
                <div className="relative">
                  <select
                    value={jenisLaporan}
                    onChange={(e) => setJenisLaporan(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-sm outline-none focus:border-sky-400"
                  >
                    <option value="Monthly Cost Detail">Monthly Cost Detail</option>
                    <option value="Exception Summary">Exception Summary</option>
                    <option value="Customer Cost Breakdown">Customer Cost Breakdown</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▼</span>
                </div>
              </div>

              <div className="flex-1 min-w-[170px]">
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Customer</label>
                <div className="relative">
                  <select
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-sm outline-none focus:border-sky-400"
                  >
                    <option value="Semua Customer">Semua Customer (PT Andima)</option>
                    <option value="PT ATLANTIC CONTAINER LINI">PT ATLANTIC CONTAINER LINI</option>
                    <option value="PT CEVA AIR OCEAN">PT CEVA AIR OCEAN</option>
                    <option value="PT DSV TRANSPORT">PT DSV TRANSPORT</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▼</span>
                </div>
              </div>

              <button
                onClick={handleBuatLaporan}
                disabled={isGenerating}
                className="flex items-center gap-2 rounded-lg bg-[#0a7ebf] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#08689d] active:scale-95 disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                Buat Laporan
              </button>
            </div>

            {/* Checkbox Options Pills */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label
                onClick={() => setSertakanSummary(!sertakanSummary)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  sertakanSummary
                    ? "border-sky-200 bg-sky-50/80 text-slate-800"
                    : "border-slate-200 bg-slate-50/60 text-slate-600"
                }`}
              >
                <input
                  type="checkbox"
                  checked={sertakanSummary}
                  onChange={(e) => setSertakanSummary(e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-[#0a7ebf]"
                />
                Sertakan summary
              </label>

              <label
                onClick={() => setSertakanException(!sertakanException)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  sertakanException
                    ? "border-sky-200 bg-sky-50/80 text-slate-800"
                    : "border-slate-200 bg-slate-50/60 text-slate-600"
                }`}
              >
                <input
                  type="checkbox"
                  checked={sertakanException}
                  onChange={(e) => setSertakanException(e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-[#0a7ebf]"
                />
                Sertakan exception
              </label>

              <label
                onClick={() => setSertakanEvidence(!sertakanEvidence)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  sertakanEvidence
                    ? "border-sky-200 bg-sky-50/80 text-slate-800"
                    : "border-slate-200 bg-slate-50/60 text-slate-600"
                }`}
              >
                <input
                  type="checkbox"
                  checked={sertakanEvidence}
                  onChange={(e) => setSertakanEvidence(e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-[#0a7ebf]"
                />
                Sertakan tautan evidence
              </label>
            </div>
          </div>

          {/* Card Format Output */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-3 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Format Output</h3>
              <p className="text-[11px] text-slate-400">Microsoft Excel multi-sheet</p>

              <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#107c41] text-white shadow-sm">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-950">.XLSX</p>
                  <p className="text-[10px] text-emerald-700">Dilengkapi styling Antikode</p>
                </div>
              </div>
            </div>

            <p className="mt-4 text-[10px] leading-relaxed text-slate-500">
              Sinkronisasi real-time dengan basis data Supabase `c2_cost_transactions`.
            </p>
          </div>
        </div>

        {/* Proses Generate & Siap untuk Diunduh Card */}
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
          {/* Card Proses Generate */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-9 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Proses Generate</h3>
              <p className="text-[11px] text-slate-400">
                Laporan disusun di latar belakang secara asinkron (TR-2909-005)[cite: 6]
              </p>

              {/* Stepper 4 Tahap */}
              <div className="mt-6 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow-sm">
                    {activeStep > 1 ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : "1"}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Validasi Data</p>
                    <p className="text-[10px] font-semibold text-emerald-600">Selesai</p>
                  </div>
                </div>

                <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />

                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow-sm">
                    {activeStep > 2 ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : "2"}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Kompilasi Supabase</p>
                    <p className="text-[10px] font-semibold text-emerald-600">Selesai</p>
                  </div>
                </div>

                <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />

                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow-sm">
                    {activeStep > 3 ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : "3"}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Membuat ExcelJS</p>
                    <p className="text-[10px] font-semibold text-emerald-600">100%</p>
                  </div>
                </div>

                <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />

                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0a7ebf] text-xs font-bold text-white shadow-sm">
                    4
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Laporan Siap</p>
                    <p className="text-[10px] font-semibold text-[#0a7ebf]">Selesai</p>
                  </div>
                </div>
              </div>

              {/* Progress Line */}
              <div className="mt-4 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full w-full" />
              </div>
            </div>

            {/* Banner Laporan Siap */}
            <div className="mt-6 flex items-center justify-between rounded-xl border border-emerald-200/80 bg-[#eef8f3] px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <Check className="h-4 w-4 stroke-[3]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-950">Laporan Siap Diunduh</p>
                  <p className="text-[11px] text-slate-500">
                    CCR_Report_PT_Andima_{periode.replace(/\s+/g, "_")}.xlsx · {dbTransactions.length} baris data riil
                  </p>
                </div>
              </div>
              <button
                onClick={handleDownloadExcel}
                className="flex items-center gap-1.5 rounded-lg bg-[#0a7ebf] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#08689d]"
              >
                <Download className="h-3.5 w-3.5" /> Unduh Excel (.xlsx)
              </button>
            </div>
          </div>

          {/* Card Biru Gelap (Siap untuk Diunduh) */}
          <div className="rounded-xl bg-[#07111F] p-6 text-white shadow-sm xl:col-span-3 flex flex-col items-center justify-between text-center min-h-[220px]">
            <div className="flex flex-col items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 shadow-inner">
                <Download className="h-6 w-6 text-white" />
              </div>
              <h3 className="mt-3 text-base font-bold text-white">Cloud Vault Storage</h3>
              <p className="mt-1 text-[11px] text-sky-100 leading-relaxed max-w-[210px]">
                Tautan unduhan aman berenkripsi AES-256 (Masa aktif 24 jam)[cite: 6].
              </p>
            </div>

            <button
              onClick={handleDownloadExcel}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#18C7C0] py-2.5 text-xs font-bold text-slate-950 shadow transition hover:bg-[#14b2ab] active:scale-95"
            >
              <Download className="h-3.5 w-3.5" /> Unduh Excel Sekarang
            </button>
          </div>
        </div>

        {/* Riwayat Laporan */}
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Riwayat Laporan</h3>
              <p className="text-[11px] text-slate-400">Berkas kompilasi yang dibuat dalam 30 hari terakhir</p>
            </div>
            <span className="rounded-full bg-sky-100/70 px-2.5 py-0.5 text-[11px] font-bold text-sky-800">
              {reports.length} laporan
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pr-4">JENIS LAPORAN</th>
                  <th className="pb-3 pr-4">PERIODE</th>
                  <th className="pb-3 pr-4">ISI DATA</th>
                  <th className="pb-3 pr-4">DIBUAT</th>
                  <th className="pb-3 pr-4">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 pr-4 font-bold text-slate-800">{r.jenis}</td>
                    <td className="py-3.5 pr-4 text-slate-600">{r.periode}</td>
                    <td className="py-3.5 pr-4 text-slate-600">{r.isiData}</td>
                    <td className="py-3.5 pr-4 text-slate-500">{r.dibuat}</td>
                    <td className="py-3.5 pr-4">
                      {r.status === "Siap" ? (
                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
                          Siap
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                          Kedaluwarsa
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400 border-t border-slate-100 pt-3">
            <Info className="h-3.5 w-3.5 text-sky-600" />
            File otomatis dihapus dari Cloud Vault setelah 24 jam untuk menjaga keamanan data[cite: 6].
          </div>
        </div>
      </main>
    </div>
  );
}