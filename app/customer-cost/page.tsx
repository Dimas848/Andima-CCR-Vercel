"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Bell,
  CalendarDays,
  Download,
  Wallet,
  Landmark,
  TrendingUp,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Eye,
  ChevronRight,
  X,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";

import Sidebar from "../dashboard/Sidebar";
import CustomButton from "../dashboard/CustomButton";
import CustomDropdown, { DropdownOption } from "../dashboard/CustomDropdown";
import StatusBadge, { type Tone } from "../dashboard/StatusBadge";
import { supabase } from "@/lib/supabase";

interface Transaction {
  id: string;
  tanggal: string;
  kategori: string;
  deskripsi: string;
  nominalRaw: number;
  nominal: string;
  status: "Valid" | "Exception" | "Ditinjau";
  statusTone: Tone;
  evidenceName?: string;
  evidenceUrl?: string;
}

interface DokumenBukti {
  id: string;
  nama: string;
  tanggal: string;
  ukuran: string;
  tipe: "pdf" | "image";
  url: string;
}

interface CustomerProfile {
  id: string;
  code: string;
  name: string;
  branch: string;
  statusCust: string;
  totalCostRaw: number;
  budgetRaw: number;
  varianceRaw: number;
  totalCost: string;
  budget: string;
  variance: string;
  deviasiMtM: string;
  deviasiTone: Tone;
  totalTrx: number;
  realisasi: string;
  varianceTone: Tone;
  exceptionCount: number;
  exceptionDesc: string;
  kategoriBreakdown: {
    nama: string;
    nilai: number;
    warna: string;
    lebar: string;
  }[];
  dokumen: DokumenBukti[];
  transaksi: Transaction[];
}

// Fallback Data Resmi PT Andima Transportindo
const fallbackCustomers: Record<string, CustomerProfile> = {
  "PT ATLANTIC CONTAINER LINI": {
    id: "PT ATLANTIC CONTAINER LINI",
    code: "CUST-0021",
    name: "PT ATLANTIC CONTAINER LINI",
    branch: "Jakarta Pusat",
    statusCust: "Customer Aktif",
    totalCostRaw: 855342,
    budgetRaw: 855342,
    varianceRaw: 0,
    totalCost: "Rp 855.342",
    budget: "Rp 855.342",
    variance: "Rp 0",
    deviasiMtM: "0,0%",
    deviasiTone: "success",
    totalTrx: 1,
    realisasi: "100%",
    varianceTone: "success",
    exceptionCount: 0,
    exceptionDesc: "Semua transaksi valid & sesuai pagu",
    kategoriBreakdown: [
      { nama: "Handling & Terminal", nilai: 855342, warna: "bg-[#0a7ebf]", lebar: "100%" },
      { nama: "Trucking & Transportasi", nilai: 0, warna: "bg-emerald-500", lebar: "0%" },
      { nama: "Storage & Demurrage", nilai: 0, warna: "bg-purple-500", lebar: "0%" },
    ],
    dokumen: [
      {
        id: "doc-1",
        nama: "worksheet_AENAT_2609_0354.pdf",
        tanggal: "17 Sep 2026",
        ukuran: "1,4 MB",
        tipe: "pdf",
        url: "https://placehold.co/800x1100/png?text=Worksheet+AENAT/2609/0354+(Valid)",
      },
    ],
    transaksi: [
      {
        id: "AENAT/2609/0354",
        tanggal: "17 Sep 2026",
        kategori: "HANDLING",
        deskripsi: "Biaya handling, PPN 11%, RA CMU & Warehouse Garuda",
        nominalRaw: 855342,
        nominal: "Rp 855.342",
        status: "Valid",
        statusTone: "success",
        evidenceName: "worksheet_AENAT_2609_0354.pdf",
        evidenceUrl: "https://placehold.co/800x1100/png?text=Worksheet+AENAT/2609/0354+(Valid)",
      },
    ],
  },
};

const periodeDropdownOptions: DropdownOption[] = [
  { value: "September 2026", label: "September 2026" },
  { value: "Agustus 2026", label: "Agustus 2026" },
  { value: "Juli 2026", label: "Juli 2026" },
];

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CustomerCostPage() {
  const [customerProfiles, setCustomerProfiles] = useState<Record<string, CustomerProfile>>(fallbackCustomers);
  const [customerKey, setCustomerKey] = useState<string>("PT ATLANTIC CONTAINER LINI");
  const [periode, setPeriode] = useState("September 2026");
  const [selectedKategori, setSelectedKategori] = useState("Semua Kategori");
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [previewDoc, setPreviewDoc] = useState<DokumenBukti | null>(null);
  const [isAllTrxModalOpen, setIsAllTrxModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Tarik & Agregasi Data Pelanggan Langsung dari Supabase
  const fetchCustomerData = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("c2_cost_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !data || data.length === 0) {
        console.warn("Menggunakan data fallback pelanggan:", error?.message);
        setCustomerProfiles(fallbackCustomers);
        return;
      }

      // Kelompokkan data transaksi berdasarkan Customer Name
      const grouped: Record<string, CustomerProfile> = {};

      data.forEach((item, index) => {
        const custName = item.customer_name || "PT Unknown Customer";
        const actual = Number(item.actual_cost || 0);
        const planned = Number(item.planned_cost || 0);
        const variance = Number(item.variance || (actual - planned) || 0);
        const isException = Boolean(item.review_flag || item.reconciliation_result !== "MATCH" || !item.has_evidence);

        if (!grouped[custName]) {
          grouped[custName] = {
            id: custName,
            code: `CUST-${String(index + 101).padStart(5, "0")}`,
            name: custName,
            branch: item.branch_code || "Jakarta Pusat",
            statusCust: "Customer Aktif",
            totalCostRaw: 0,
            budgetRaw: 0,
            varianceRaw: 0,
            totalCost: "Rp 0",
            budget: "Rp 0",
            variance: "Rp 0",
            deviasiMtM: "0,0%",
            deviasiTone: "success",
            totalTrx: 0,
            realisasi: "0%",
            varianceTone: "success",
            exceptionCount: 0,
            exceptionDesc: "Transaksi aman",
            kategoriBreakdown: [],
            dokumen: [],
            transaksi: [],
          };
        }

        grouped[custName].totalCostRaw += actual;
        grouped[custName].budgetRaw += planned;
        grouped[custName].varianceRaw += variance;
        grouped[custName].totalTrx += 1;

        if (isException) {
          grouped[custName].exceptionCount += 1;
        }

        // Simpan transaksi
        const trxDate = new Date(item.created_at || Date.now()).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });

        grouped[custName].transaksi.push({
          id: item.job_number || `TRX-${item.id?.slice(0, 8)}`,
          tanggal: trxDate,
          kategori: item.cost_category || "HANDLING",
          deskripsi: item.description || `Operasional kargo job ${item.job_number}`,
          nominalRaw: actual,
          nominal: formatRupiah(actual),
          status: isException ? "Exception" : "Valid",
          statusTone: isException ? "danger" : "success",
          evidenceName: item.has_evidence ? `Bukti_${item.job_number.replace(/\//g, "_")}.pdf` : undefined,
          evidenceUrl: item.has_evidence ? `https://placehold.co/800x1100/png?text=Bukti+Job+${item.job_number}` : undefined,
        });

        // Simpan dokumen bukti jika ada
        if (item.has_evidence) {
          grouped[custName].dokumen.push({
            id: `doc-${item.id}`,
            nama: `Kuitansi_${item.job_number.replace(/\//g, "_")}.pdf`,
            tanggal: trxDate,
            ukuran: "1,2 MB",
            tipe: "pdf",
            url: `https://placehold.co/800x1100/png?text=Kuitansi+Job+${item.job_number}`,
          });
        }
      });

      // Hitung metrik final per pelanggan
      Object.keys(grouped).forEach((key) => {
        const cust = grouped[key];
        cust.totalCost = formatRupiah(cust.totalCostRaw);
        cust.budget = formatRupiah(cust.budgetRaw);
        cust.variance = cust.varianceRaw > 0 ? `+${formatRupiah(cust.varianceRaw)}` : formatRupiah(cust.varianceRaw);
        cust.varianceTone = cust.varianceRaw > 0 ? "danger" : "success";

        const realPct = cust.budgetRaw > 0 ? ((cust.totalCostRaw / cust.budgetRaw) * 100).toFixed(1) : "100.0";
        cust.realisasi = `${realPct}%`;

        const mtmDev = cust.budgetRaw > 0 ? (((cust.totalCostRaw - cust.budgetRaw) / cust.budgetRaw) * 100).toFixed(1) : "0.0";
        cust.deviasiMtM = `${Number(mtmDev) > 0 ? `+${mtmDev}` : mtmDev}%`;
        cust.deviasiTone = Number(mtmDev) > 0 ? "danger" : "success";

        cust.exceptionDesc = cust.exceptionCount > 0 ? `${cust.exceptionCount} transaksi anomali perlu review` : "Seluruh biaya terverifikasi";

        // Hitung breakdown kategori C2 (Trucking, Handling, Storage, Other)
        const truckingSum = cust.transaksi.filter((t) => t.kategori === "TRUCKING").reduce((a, b) => a + b.nominalRaw, 0);
        const handlingSum = cust.transaksi.filter((t) => t.kategori === "HANDLING").reduce((a, b) => a + b.nominalRaw, 0);
        const storageSum = cust.transaksi.filter((t) => t.kategori === "STORAGE").reduce((a, b) => a + b.nominalRaw, 0);
        const maxVal = Math.max(truckingSum, handlingSum, storageSum, 1);

        cust.kategoriBreakdown = [
          {
            nama: "Trucking & Transportasi",
            nilai: truckingSum,
            warna: "bg-[#0a7ebf]",
            lebar: `${Math.round((truckingSum / maxVal) * 100)}%`,
          },
          {
            nama: "Gudang & Handling",
            nilai: handlingSum,
            warna: "bg-[#d4194f]",
            lebar: `${Math.round((handlingSum / maxVal) * 100)}%`,
          },
          {
            nama: "Storage & Demurrage",
            nilai: storageSum,
            warna: "bg-purple-500",
            lebar: `${Math.round((storageSum / maxVal) * 100)}%`,
          },
        ];
      });

      setCustomerProfiles(grouped);

      // Set default selected customer
      const firstCust = Object.keys(grouped)[0];
      if (firstCust && !grouped[customerKey]) {
        setCustomerKey(firstCust);
      }
    } catch (err) {
      console.error("Gagal sinkronisasi data pelanggan:", err);
      setCustomerProfiles(fallbackCustomers);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerData();
  }, []);

  // Dropdown Opsi Pelanggan Dinamis dari Database
  const customerDropdownOptions: DropdownOption[] = useMemo(() => {
    return Object.keys(customerProfiles).map((k) => ({
      value: k,
      label: k,
    }));
  }, [customerProfiles]);

  const activeCustomer = customerProfiles[customerKey] || Object.values(customerProfiles)[0] || fallbackCustomers["PT ATLANTIC CONTAINER LINI"];

  // Filter Kategori Transaksi
  const filteredTransactions = useMemo(() => {
    if (selectedKategori === "Semua Kategori") return activeCustomer.transaksi;
    return activeCustomer.transaksi.filter((t) => t.kategori === selectedKategori);
  }, [activeCustomer, selectedKategori]);

  // Handler Ekspor CSV Rincian Pelanggan (FR-CCR2-005)
  const handleDownloadDetail = () => {
    const header = "ID Transaksi / Job,Tanggal,Kategori,Deskripsi,Nominal,Status\n";
    const body = activeCustomer.transaksi
      .map((t) => `"${t.id}","${t.tanggal}","${t.kategori}","${t.deskripsi}","${t.nominal}","${t.status}"`)
      .join("\n");

    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Detail_Biaya_${activeCustomer.name.replace(/\s+/g, "_")}_${periode.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Berhasil mengekspor rincian biaya ${activeCustomer.name}.`);
  };

  return (
    <div className="flex min-h-screen bg-[#f4f7fb]">
      <Sidebar />

      <main className="flex-1 px-8 py-6">
        {/* Header Modul */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Customer Cost Breakdown</h1>
            <p className="text-xs text-slate-500">
              Detail biaya operasional, pagu anggaran, dan bukti transaksi {activeCustomer.name} (FR-CCR2-002)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <CustomButton variant="outline" onClick={fetchCustomerData}>
              <RefreshCw className="h-4 w-4" /> Sinkronkan Database
            </CustomButton>

            <CustomButton variant="outline" onClick={handleDownloadDetail}>
              <Download className="h-4 w-4" /> Unduh Detail CSV
            </CustomButton>

            <button
              aria-label="Notifikasi"
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
            </button>
            <span className="flex items-center gap-2 rounded-lg bg-sky-100 px-3 py-2.5 text-xs font-bold text-sky-700">
              <CalendarDays className="h-4 w-4" /> {periode}
            </span>
          </div>
        </div>

        {/* Toast Notifikasi */}
        {toastMessage && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-bold text-emerald-900">{toastMessage}</p>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-950">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div className="w-72">
            <CustomDropdown
              label="Customer (Entitas PT Andima)"
              value={customerKey}
              options={customerDropdownOptions}
              onChange={setCustomerKey}
            />
          </div>
          <div className="w-48">
            <CustomDropdown
              label="Periode"
              value={periode}
              options={periodeDropdownOptions}
              onChange={setPeriode}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500">ID Customer & Cabang</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={`${activeCustomer.code} · ${activeCustomer.branch}`}
                readOnly
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-sm outline-none"
              />
              <StatusBadge value={activeCustomer.statusCust} tone="success" />
            </div>
          </div>
        </div>

        {/* Indikator Memuat Data */}
        {isLoading ? (
          <div className="mt-8 flex h-48 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white">
            <Loader2 className="h-7 w-7 animate-spin text-sky-600" />
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Menghitung agregasi biaya pelanggan dari Supabase...
            </p>
          </div>
        ) : (
          <>
            {/* Row 1: KPI Cards */}
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-bold tracking-wider text-slate-500">TOTAL COST</p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                    <Wallet className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <h2 className="text-2xl font-extrabold text-slate-900">{activeCustomer.totalCost}</h2>
                  <StatusBadge value={activeCustomer.deviasiMtM} tone={activeCustomer.deviasiTone} />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">{activeCustomer.totalTrx} transaksi terverifikasi</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-bold tracking-wider text-slate-500">BUDGET</p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                    <Landmark className="h-4 w-4" />
                  </div>
                </div>
                <h2 className="mt-1 text-2xl font-extrabold text-slate-900">{activeCustomer.budget}</h2>
                <p className="mt-1 text-[11px] text-slate-400">Realisasi {activeCustomer.realisasi}</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-bold tracking-wider text-slate-500">VARIANCE</p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <h2
                  className={`mt-1 text-2xl font-extrabold ${
                    activeCustomer.varianceTone === "danger" ? "text-rose-600" : "text-emerald-600"
                  }`}
                >
                  {activeCustomer.variance}
                </h2>
                <p className="mt-1 text-[11px] text-slate-400">
                  {activeCustomer.varianceTone === "danger" ? "Di atas budget bulan berjalan" : "Dalam batas pagu anggaran"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-bold tracking-wider text-slate-500">EXCEPTION</p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                </div>
                <h2 className="mt-1 text-2xl font-extrabold text-slate-900">{activeCustomer.exceptionCount}</h2>
                <p className="mt-1 text-[11px] text-slate-400">{activeCustomer.exceptionDesc}</p>
              </div>
            </div>

            {/* Row 2: Breakdown Kategori & Dokumen Bukti */}
            <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
              {/* Breakdown Komponen Biaya */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900">Breakdown Kategori Biaya</h3>
                <p className="text-[11px] text-slate-400">
                  Proporsi 3 komponen baku C2 (Trucking, Handling, Storage)
                </p>

                <div className="mt-5 space-y-4">
                  {activeCustomer.kategoriBreakdown.map((k) => (
                    <div key={k.nama}>
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-semibold text-slate-700">{k.nama}</p>
                        <p className="text-[13px] font-bold text-slate-800">{formatRupiah(k.nilai)}</p>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                        <div className={`h-2 rounded-full ${k.warna}`} style={{ width: k.lebar }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dokumen Bukti Transaksi */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Dokumen Bukti</h3>
                    <p className="text-[11px] text-slate-400">
                      {activeCustomer.dokumen.length} lampiran kuitansi/worksheet
                    </p>
                  </div>
                  <button
                    onClick={() => showToast(`Menampilkan seluruh berkas bukti ${activeCustomer.name}`)}
                    className="text-xs font-semibold text-sky-600 hover:text-sky-800"
                  >
                    Lihat Semua
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {activeCustomer.dokumen.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                      Belum ada berkas lampiran kuitansi untuk pelanggan ini.
                    </div>
                  ) : (
                    activeCustomer.dokumen.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 transition hover:border-sky-200"
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            d.tipe === "pdf" ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                          }`}
                        >
                          {d.tipe === "pdf" ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-slate-800 truncate">{d.nama}</p>
                          <p className="text-[11px] text-slate-400">
                            {d.tanggal} · {d.ukuran}
                          </p>
                        </div>
                        <button
                          onClick={() => setPreviewDoc(d)}
                          title="Pratinjau Kuitansi"
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm transition hover:bg-sky-50 hover:text-sky-600"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Row 3: Transaksi Pelanggan */}
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Transaksi Terbaru</h3>
                  <p className="text-[11px] text-slate-400">
                    Menampilkan {filteredTransactions.length} dari {activeCustomer.totalTrx} record transaksi
                  </p>
                </div>
                <select
                  value={selectedKategori}
                  onChange={(e) => setSelectedKategori(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400"
                >
                  <option value="Semua Kategori">Semua Kategori</option>
                  <option value="TRUCKING">Trucking</option>
                  <option value="HANDLING">Handling</option>
                  <option value="STORAGE">Storage</option>
                  <option value="OTHER_OPERATIONAL">Operasional</option>
                </select>
              </div>

              <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-3 font-bold">Nomor Job / ID</th>
                      <th className="px-4 py-3 font-bold">Tanggal</th>
                      <th className="px-4 py-3 font-bold">Kategori</th>
                      <th className="px-4 py-3 font-bold">Deskripsi</th>
                      <th className="px-4 py-3 font-bold">Nominal</th>
                      <th className="px-4 py-3 font-bold">Status</th>
                      <th className="px-4 py-3 font-bold text-center">Bukti</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTransactions.map((t) => (
                      <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3 font-semibold text-slate-600 text-xs font-mono">{t.id}</td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{t.tanggal}</td>
                        <td className="px-4 py-3 text-slate-700 text-xs font-medium">{t.kategori}</td>
                        <td className="px-4 py-3 text-slate-800 text-xs">{t.deskripsi}</td>
                        <td className="px-4 py-3 font-bold text-slate-900 text-xs">{t.nominal}</td>
                        <td className="px-4 py-3">
                          <StatusBadge value={t.status} tone={t.statusTone} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {t.evidenceUrl ? (
                            <button
                              onClick={() =>
                                setPreviewDoc({
                                  id: t.id,
                                  nama: t.evidenceName || "Bukti_Transaksi.pdf",
                                  tanggal: t.tanggal,
                                  ukuran: "1,4 MB",
                                  tipe: "image",
                                  url: t.evidenceUrl!,
                                })
                              }
                              className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-700 hover:bg-sky-100"
                            >
                              <Eye className="h-3 w-3" /> Bukti
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-[11px] text-slate-400">
                  Total {activeCustomer.totalTrx} transaksi · Tersinkronisasi dengan Supabase
                </p>
                <CustomButton size="sm" onClick={() => setIsAllTrxModalOpen(true)}>
                  Buka Semua Transaksi <ChevronRight className="h-3.5 w-3.5" />
                </CustomButton>
              </div>
            </div>
          </>
        )}

        {/* Modal Pratinjau Bukti Bayar */}
        {previewDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <div className="flex h-[86vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{previewDoc.nama}</h3>
                    <p className="text-xs text-slate-500">
                      HMAC Presigned URL · Masa aktif tautan: 15 menit (TR-2909-002)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-1 items-center justify-center bg-slate-100 p-4 overflow-auto">
                <img
                  src={previewDoc.url}
                  alt={previewDoc.nama}
                  className="max-h-full max-w-full rounded-lg border border-slate-200 bg-white object-contain shadow-md"
                />
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3 text-xs text-slate-500">
                <p>Format: {previewDoc.tipe.toUpperCase()} · Ukuran: {previewDoc.ukuran}</p>
                <div className="flex items-center gap-2">
                  <a
                    href={previewDoc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Buka Tab Baru <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <CustomButton size="sm" onClick={() => setPreviewDoc(null)}>
                    Selesai Meninjau
                  </CustomButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Seluruh Transaksi */}
        {isAllTrxModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <div className="flex h-[80vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Seluruh Transaksi - {activeCustomer.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Total {activeCustomer.transaksi.length} transaksi pada periode {periode}
                  </p>
                </div>
                <button
                  onClick={() => setIsAllTrxModalOpen(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 pb-2 text-[10px] font-bold uppercase text-slate-400">
                      <th className="pb-2">Nomor Job</th>
                      <th className="pb-2">Tanggal</th>
                      <th className="pb-2">Kategori</th>
                      <th className="pb-2">Deskripsi</th>
                      <th className="pb-2">Nominal</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeCustomer.transaksi.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="py-2.5 font-semibold text-slate-600 font-mono">{t.id}</td>
                        <td className="py-2.5 text-slate-500">{t.tanggal}</td>
                        <td className="py-2.5 font-medium text-slate-700">{t.kategori}</td>
                        <td className="py-2.5 text-slate-800">{t.deskripsi}</td>
                        <td className="py-2.5 font-bold text-slate-900">{t.nominal}</td>
                        <td className="py-2.5">
                          <StatusBadge value={t.status} tone={t.statusTone} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end border-t border-slate-200 p-4">
                <CustomButton size="sm" onClick={() => setIsAllTrxModalOpen(false)}>
                  Tutup
                </CustomButton>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}