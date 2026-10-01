"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import ExcelJS from "exceljs";
import {
  Download,
  Bell,
  CalendarDays,
  SlidersHorizontal,
  CreditCard,
  Landmark,
  TrendingUp,
  Users,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";

import Sidebar from "./Sidebar";
import BudgetChart from "./BudgetChart";
import CustomerBreakdown from "./CustomerBreakdown";
import ExceptionSummary from "./ExceptionSummary";
import DataHealth from "./DataHealth";
import CustomDropdown, { DropdownOption } from "./CustomDropdown";
import { supabase } from "@/lib/supabase";

// Interface Transaksi Biaya C2
interface CostTransaction {
  id: string;
  job_number: string;
  customer_name: string;
  branch_code: string;
  cost_category: string;
  period_month: string;
  planned_cost: number;
  actual_cost: number;
  variance: number;
  has_evidence: boolean;
  reconciliation_result: string;
  review_flag: boolean;
  exception_tags: string[];
}

// Opsi Periode & Cabang Resmi PT Andima Transportindo
const periodeOptions: DropdownOption[] = [
  { value: "September 2026", label: "September 2026" },
  { value: "Agustus 2026", label: "Agustus 2026" },
  { value: "Juli 2026", label: "Juli 2026" },
  { value: "Juni 2026", label: "Juni 2026" },
];

const regionOptions: DropdownOption[] = [
  { value: "ALL", label: "Nasional (Semua Cabang)" },
  { value: "Jakarta Pusat", label: "Jakarta Pusat" },
  { value: "Surabaya", label: "Surabaya" },
  { value: "Semarang", label: "Semarang" },
];

// Helper Format Rupiah Compact & Standar
const formatCompactRupiah = (val: number) => {
  if (Math.abs(val) >= 1_000_000_000) {
    return `Rp ${(val / 1_000_000_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} M`;
  }
  if (Math.abs(val) >= 1_000_000) {
    return `Rp ${(val / 1_000_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} jt`;
  }
  return `Rp ${val.toLocaleString("id-ID")}`;
};

export default function DashboardPage() {
  const router = useRouter();

  // State Data Supabase & Status Loading
  const [allTransactions, setAllTransactions] = useState<CostTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<CostTransaction[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // State Filter (FR-CCR2-002-04 & FR-CCR2-003-07)
  const [periode, setPeriode] = useState("September 2026");
  const [entitas, setEntitas] = useState("ALL");
  const [region, setRegion] = useState("ALL");
  const [isFiltering, setIsFiltering] = useState(false);

  // State Ekspor Latar Belakang (FR-CCR2-005)
  const [exportState, setExportState] = useState<"idle" | "queueing" | "ready">("idle");
  const [exportJobId, setExportJobId] = useState<string | null>(null);

  // 1. Tarik Data Live dari Supabase Tabel c2_cost_transactions
  useEffect(() => {
    async function fetchSupabaseData() {
      try {
        setIsLoadingData(true);
        const { data, error } = await supabase
          .from("c2_cost_transactions")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Gagal mengambil data dari Supabase:", error.message);
        } else if (data) {
          const formatted: CostTransaction[] = data.map((item) => ({
            id: item.id,
            job_number: item.job_number,
            customer_name: item.customer_name,
            branch_code: item.branch_code || "Jakarta Pusat",
            cost_category: item.cost_category,
            period_month: item.period_month || "September 2026",
            planned_cost: Number(item.planned_cost || 0),
            actual_cost: Number(item.actual_cost || 0),
            variance: Number(item.variance || 0),
            has_evidence: Boolean(item.has_evidence),
            reconciliation_result: item.reconciliation_result || "MATCH",
            review_flag: Boolean(item.review_flag),
            exception_tags: item.exception_tags || [],
          }));

          setAllTransactions(formatted);
          setFilteredTransactions(formatted);
        }
      } catch (err) {
        console.error("Koneksi gagal:", err);
      } finally {
        setIsLoadingData(false);
      }
    }

    fetchSupabaseData();
  }, []);

  // 2. Buat Opsi Dropdown Entitas Secara Dinamis Berdasarkan Customer Riil di Database
  const dynamicEntitasOptions: DropdownOption[] = useMemo(() => {
    const uniqueCustomers = Array.from(new Set(allTransactions.map((t) => t.customer_name))).filter(Boolean);
    const options: DropdownOption[] = [{ value: "ALL", label: "Semua Entitas" }];
    uniqueCustomers.forEach((cust) => {
      options.push({ value: cust, label: cust });
    });
    return options;
  }, [allTransactions]);

  // 3. Handler Terapkan Filter
  const handleApplyFilter = () => {
    setIsFiltering(true);
    setTimeout(() => {
      let filtered = [...allTransactions];

      if (periode !== "ALL") {
        filtered = filtered.filter((t) => t.period_month === periode);
      }
      if (entitas !== "ALL") {
        filtered = filtered.filter((t) => t.customer_name === entitas);
      }
      if (region !== "ALL") {
        filtered = filtered.filter((t) => t.branch_code === region);
      }

      setFilteredTransactions(filtered);
      setIsFiltering(false);
    }, 300);
  };

  // 4. Kalkulasi KPI Makro secara Real-Time dari Data Supabase (FR-CCR2-002-02)
  const kpiData = useMemo(() => {
    const totalActual = filteredTransactions.reduce((acc, curr) => acc + curr.actual_cost, 0);
    const totalPlanned = filteredTransactions.reduce((acc, curr) => acc + curr.planned_cost, 0);
    const totalVariance = totalActual - totalPlanned;
    const variancePercent = totalPlanned > 0 ? ((totalVariance / totalPlanned) * 100).toFixed(1) : "0.0";
    const realisasiPercent = totalPlanned > 0 ? ((totalActual / totalPlanned) * 100).toFixed(1) : "0.0";

    const verifiedCount = filteredTransactions.filter((t) => t.has_evidence).length;
    const totalCustomerCount = new Set(filteredTransactions.map((t) => t.customer_name)).size;
    const attentionCustomerCount = new Set(
      filteredTransactions.filter((t) => t.review_flag).map((t) => t.customer_name)
    ).size;

    return {
      totalActual,
      totalPlanned,
      totalVariance,
      variancePercent,
      realisasiPercent,
      verifiedCount,
      totalCustomerCount,
      attentionCustomerCount,
      totalTransactions: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  // Handler Ekspor Asinkron (Zero UI Freeze) & Kompilasi ExcelJS Nyata
  const handleAsyncExport = () => {
    setExportState("queueing");
    const simulatedJobId = `EXP-${Date.now().toString().slice(-6)}`;
    setExportJobId(simulatedJobId);

    setTimeout(() => {
      setExportState("ready");
    }, 1000);
  };

  // Fungsi Nyata Mengunduh Excel (.xlsx) dengan ExcelJS
  const handleDownloadExcelFiles = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "C2 Finance Ops Engine (PT Andima)";
      workbook.created = new Date();

      // Sheet 1: Ringkasan MtM
      const sheet1 = workbook.addWorksheet("Ringkasan MtM");
      sheet1.columns = [
        { header: "Indikator Kinerja Keuangan", key: "indikator", width: 34 },
        { header: "Nilai Realisasi Aktual (IDR)", key: "realisasi", width: 26 },
        { header: "Pagu Anggaran (IDR)", key: "budget", width: 26 },
        { header: "Deviasi MtM", key: "deviasi", width: 18 },
      ];

      sheet1.getRow(1).eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF07111F" } };
        cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      sheet1.addRow({
        indikator: "Total Biaya Operasional Bulanan",
        realisasi: kpiData.totalActual,
        budget: kpiData.totalPlanned,
        deviasi: `${kpiData.variancePercent}%`,
      });
      sheet1.addRow({
        indikator: "Total Transaksi Tercatat",
        realisasi: kpiData.totalTransactions,
        budget: kpiData.totalTransactions,
        deviasi: "100%",
      });
      sheet1.addRow({
        indikator: "Jumlah Akun Pelanggan Aktif",
        realisasi: kpiData.totalCustomerCount,
        budget: kpiData.totalCustomerCount,
        deviasi: "Lengkap",
      });

      sheet1.getColumn(2).numFmt = "#,##0";
      sheet1.getColumn(3).numFmt = "#,##0";

      // Sheet 2: Breakdown Customer
      const sheet2 = workbook.addWorksheet("Breakdown 51 Customer");
      sheet2.columns = [
        { header: "Nama Customer", key: "name", width: 32 },
        { header: "Cabang", key: "branch", width: 18 },
        { header: "Kategori Komponen", key: "cat", width: 22 },
        { header: "Nominal Aktual (IDR)", key: "actual", width: 24 },
        { header: "Status Bukti", key: "evidence", width: 16 },
      ];

      sheet2.getRow(1).eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D1B2A" } };
        cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      filteredTransactions.forEach((t) => {
        sheet2.addRow({
          name: t.customer_name,
          branch: t.branch_code,
          cat: t.cost_category,
          actual: t.actual_cost,
          evidence: t.has_evidence ? "ADA" : "MISSING",
        });
      });
      sheet2.getColumn(4).numFmt = "#,##0";

      // Tulis buffer dan unduh
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `CCR_Dashboard_Report_${periode.replace(/\s+/g, "_")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setExportState("idle");
    } catch (err) {
      console.error("Gagal mengunduh Excel:", err);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f4f7fb]">
      <Sidebar />

      <main className="flex-1 px-8 py-7">
        {/* Header Dasbor */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Monthly Cost Dashboard
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Ringkasan kinerja biaya bulanan dan anomali utama PT Andima Transportindo
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Tombol Ekspor Asinkron (FR-CCR2-005-01) */}
            <button
              onClick={handleAsyncExport}
              disabled={exportState === "queueing"}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              {exportState === "queueing" ? (
                <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
              ) : (
                <Download className="h-4 w-4 text-slate-600" />
              )}
              {exportState === "queueing" ? "Mengantrekan..." : "Ekspor Ringkasan"}
            </button>

            {/* Notifikasi Lonceng */}
            <button
              aria-label="Lihat Notifikasi"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
            </button>

            {/* Badge Periode Aktif */}
            <span className="inline-flex items-center gap-2 rounded-lg bg-sky-100/80 px-3 py-2 text-xs font-bold text-sky-800">
              <CalendarDays className="h-4 w-4 text-sky-700" />
              {periode}
            </span>
          </div>
        </div>

        {/* Notifikasi Toast Hasil Ekspor Asinkron & Unduh Excel Nyata */}
        {exportState === "ready" && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-xs font-bold text-emerald-900">
                  Laporan Biaya Multi-Sheet Selesai Dibuat (#{exportJobId})
                </p>
                <p className="text-[11px] text-emerald-700">
                  3 lembar kerja siap diunduh berdasarkan data live Supabase.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadExcelFiles}
                className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-700 transition"
              >
                Unduh .xlsx Sekarang
              </button>
              <button
                onClick={() => setExportState("idle")}
                className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Filter Bar (Periode, Entitas, Region) */}
        <div className="mt-6 flex flex-wrap items-end gap-3.5">
          <div className="w-48">
            <CustomDropdown
              label="Periode"
              value={periode}
              options={periodeOptions}
              onChange={setPeriode}
            />
          </div>

          <div className="w-64">
            <CustomDropdown
              label="Entitas"
              value={entitas}
              options={dynamicEntitasOptions}
              onChange={setEntitas}
            />
          </div>

          <div className="w-56">
            <CustomDropdown
              label="Region"
              value={region}
              options={regionOptions}
              onChange={setRegion}
            />
          </div>

          <button
            onClick={handleApplyFilter}
            disabled={isFiltering}
            className="inline-flex h-[42px] items-center justify-center gap-2 rounded-lg bg-[#0a7ebf] px-5 text-xs font-bold text-white shadow-sm transition hover:bg-[#08689d] active:scale-95 disabled:opacity-75"
          >
            {isFiltering ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <SlidersHorizontal className="h-3.5 w-3.5" />
            )}
            Terapkan Filter
          </button>
        </div>

        {/* Indikator Status Memuat Data */}
        {isLoadingData ? (
          <div className="mt-8 flex h-48 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white">
            <Loader2 className="h-7 w-7 animate-spin text-sky-600" />
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Menghubungkan & menyinkronkan data dari Supabase...
            </p>
          </div>
        ) : (
          <>
            {/* Row 1: 4 Kartu KPI Makro Terkoneksi Supabase (FR-CCR2-002-02) */}
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {/* Card 1: TOTAL COST */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    TOTAL COST
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                    <CreditCard className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2.5">
                  <h2 className="text-2xl font-black text-slate-900">
                    {formatCompactRupiah(kpiData.totalActual)}
                  </h2>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                      Number(kpiData.variancePercent) > 0
                        ? "bg-rose-50 text-rose-600"
                        : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    {Number(kpiData.variancePercent) > 0 ? `+${kpiData.variancePercent}%` : `${kpiData.variancePercent}%`}
                  </span>
                </div>
                <p className="mt-2 text-[11px] font-medium text-slate-400">
                  {kpiData.verifiedCount} dari {kpiData.totalTransactions} transaksi terverifikasi
                </p>
              </div>

              {/* Card 2: BUDGET */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    BUDGET
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Landmark className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2.5">
                  <h2 className="text-2xl font-black text-slate-900">
                    {formatCompactRupiah(kpiData.totalPlanned)}
                  </h2>
                </div>
                <p className="mt-2 text-[11px] font-medium text-slate-400">
                  Realisasi {kpiData.realisasiPercent}%
                </p>
              </div>

              {/* Card 3: VARIANCE */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    VARIANCE
                  </span>
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      kpiData.totalVariance > 0
                        ? "bg-rose-50 text-rose-500"
                        : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2.5">
                  <h2 className="text-2xl font-black text-slate-900">
                    {kpiData.totalVariance > 0
                      ? `+${formatCompactRupiah(kpiData.totalVariance)}`
                      : formatCompactRupiah(kpiData.totalVariance)}
                  </h2>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                      kpiData.totalVariance > 0
                        ? "bg-rose-50 text-rose-600"
                        : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    {Number(kpiData.variancePercent) > 0 ? `+${kpiData.variancePercent}%` : `${kpiData.variancePercent}%`}
                  </span>
                </div>
                <p className="mt-2 text-[11px] font-medium text-slate-400">
                  {kpiData.totalVariance > 0 ? "Di atas budget bulan ini" : "Dalam batas pagu anggaran"}
                </p>
              </div>

              {/* Card 4: TOTAL CUSTOMER */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    TOTAL CUSTOMER
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Users className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2.5">
                  <h2 className="text-2xl font-black text-slate-900">
                    {kpiData.totalCustomerCount}
                  </h2>
                </div>
                <p className="mt-2 text-[11px] font-medium text-slate-400">
                  {kpiData.attentionCustomerCount} customer perlu perhatian
                </p>
              </div>
            </div>

            {/* Row 2: Visualisasi Tren MtM & Breakdown Customer */}
            <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
              <div className="xl:col-span-7">
                <BudgetChart />
              </div>
              <div className="xl:col-span-5">
                <CustomerBreakdown />
              </div>
            </div>

            {/* Row 3: Ringkasan Exception & Kesehatan Data */}
            <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
              <div className="xl:col-span-7">
                <ExceptionSummary />
              </div>
              <div className="xl:col-span-5">
                <DataHealth />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}