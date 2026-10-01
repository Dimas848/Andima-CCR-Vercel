"use client";

import { useState, useMemo, useEffect } from "react";
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
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import Sidebar from "../dashboard/Sidebar";
import { supabase } from "@/lib/supabase";

export type PriorityLevel = "Critical" | "High" | "Medium" | "Low";
export type ExceptionStatus = "Terbuka" | "Ditinjau" | "Dalam Proses" | "Selesai";

export interface PriorityExceptionRow {
  id: string;
  dbId: string;
  customer: string;
  jobNumber: string;
  voucherNo: string;
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

// Fallback Data Riil PT Andima jika offline
const fallbackRows: PriorityExceptionRow[] = [
  {
    id: "EXC-001",
    dbId: "mock-1",
    customer: "PT CEVA AIR OCEAN INDONESIA",
    jobNumber: "BI/2608/3801",
    voucherNo: "2606-006",
    masalah: "Kelebihan pagu anggaran & bukti fisik hilang",
    nominalRaw: 95000,
    varianceRaw: 17950,
    nominal: "Rp 95.000",
    variance: "+Rp 17.950",
    prioritas: "High",
    status: "Terbuka",
    slaHours: 28,
  },
  {
    id: "EXC-002",
    dbId: "mock-2",
    customer: "PT CEVA AIR OCEAN INDONESIA",
    jobNumber: "JOB-UNKNOWN-001",
    voucherNo: "2606-018",
    masalah: "Nomor pekerjaan tidak terdaftar di sistem CRM",
    nominalRaw: 500000,
    varianceRaw: 500000,
    nominal: "Rp 500.000",
    variance: "+Rp 500.000",
    prioritas: "Critical",
    status: "Terbuka",
    slaHours: 34,
  },
  {
    id: "EXC-003",
    dbId: "mock-3",
    customer: "PT DSV TRANSPORT INDONESIA",
    jobNumber: "DSVIMP/2608/2818",
    voucherNo: "BR26-06015",
    masalah: "Realisasi handling kargo impor melebihi batas",
    nominalRaw: 180930,
    varianceRaw: 130930,
    nominal: "Rp 180.930",
    variance: "+Rp 130.930",
    prioritas: "Medium",
    status: "Ditinjau",
    slaHours: 14,
  },
  {
    id: "EXC-004",
    dbId: "mock-4",
    customer: "PT CEVA AIR OCEAN INDONESIA",
    jobNumber: "BI/2608/3782",
    voucherNo: "2606-018",
    masalah: "Biaya penitipan gudang Garuda melebihi pagu",
    nominalRaw: 52000000,
    varianceRaw: 1757475,
    nominal: "Rp 52.000.000",
    variance: "+Rp 1.757.475",
    prioritas: "Critical",
    status: "Dalam Proses",
    slaHours: 8,
  },
];

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactRupiah(val: number): string {
  if (Math.abs(val) >= 1_000_000_000) {
    return `Rp ${(val / 1_000_000_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} M`;
  }
  if (Math.abs(val) >= 1_000_000) {
    return `Rp ${(val / 1_000_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} jt`;
  }
  return `Rp ${val.toLocaleString("id-ID")}`;
}

export default function PriorityExceptionPage() {
  const [rows, setRows] = useState<PriorityExceptionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPrioritas, setSelectedPrioritas] = useState("Semua Prioritas");
  const [selectedStatus, setSelectedStatus] = useState("Semua Status");

  const [activeItem, setActiveItem] = useState<PriorityExceptionRow | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Tarik Data Live Anomali dari Supabase (c2_cost_transactions)
  const fetchPriorityData = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("c2_cost_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !data || data.length === 0) {
        console.warn("Menggunakan data fallback lokal:", error?.message);
        setRows(fallbackRows);
        return;
      }

      // Filter hanya transaksi yang membutuhkan perhatian
      const filtered = data.filter(
        (t) => t.review_flag || t.reconciliation_result !== "MATCH" || !t.has_evidence
      );

      const transformed: PriorityExceptionRow[] = filtered.map((item, idx) => {
        const actual = Number(item.actual_cost || 0);
        const planned = Number(item.planned_cost || 0);
        const variance = Number(item.variance || (actual - planned) || 0);

        // Tentukan masalah utama
        let masalah = "Transaksi normal";
        const tags = item.exception_tags || [];
        if (item.job_number === "UNMATCHED" || item.job_number.includes("UNKNOWN") || planned === 0) {
          masalah = "Nomor pekerjaan tidak terdaftar di sistem CRM";
        } else if (variance > 0 && !item.has_evidence) {
          masalah = "Kelebihan anggaran & bukti kuitansi hilang";
        } else if (variance > 0) {
          masalah = "Realisasi biaya melebihi pagu anggaran (Over Budget)";
        } else if (!item.has_evidence) {
          masalah = "Lampiran berkas kuitansi transaksi belum diunggah";
        }

        // Tentukan Level Prioritas (Critical, High, Medium, Low)
        let prioritas: PriorityLevel = "Low";
        if (item.job_number.includes("UNKNOWN") || actual >= 50000000) {
          prioritas = "Critical";
        } else if (variance > 0 || tags.includes("OVER_BUDGET")) {
          prioritas = "High";
        } else if (!item.has_evidence) {
          prioritas = "Medium";
        }

        // Hitung umur jam SLA berdasarkan created_at
        const createdTime = new Date(item.created_at || Date.now()).getTime();
        const diffHours = Math.max(1, Math.floor((Date.now() - createdTime) / (1000 * 60 * 60)));

        return {
          id: `EXC-${String(idx + 1).padStart(3, "0")}`,
          dbId: item.id,
          customer: item.customer_name || "PT Unknown Customer",
          jobNumber: item.job_number,
          voucherNo: item.voucher_no || `VCH-2609-${String(idx + 1).padStart(3, "0")}`,
          masalah,
          nominalRaw: actual,
          varianceRaw: variance,
          nominal: formatRupiah(actual),
          variance: variance > 0 ? `+${formatRupiah(variance)}` : formatRupiah(variance),
          prioritas,
          status: item.review_flag ? "Terbuka" : "Selesai",
          slaHours: diffHours,
          resolutionNotes: item.description,
        };
      });

      setRows(transformed.length > 0 ? transformed : fallbackRows);
    } catch (err) {
      console.error("Gagal sinkronisasi data prioritas:", err);
      setRows(fallbackRows);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPriorityData();
  }, []);

  // 2. Filter Bar
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchSearch =
        r.customer.toLowerCase().includes(search.toLowerCase()) ||
        r.id.toLowerCase().includes(search.toLowerCase()) ||
        r.masalah.toLowerCase().includes(search.toLowerCase()) ||
        r.jobNumber.toLowerCase().includes(search.toLowerCase());

      const matchPrioritas =
        selectedPrioritas === "Semua Prioritas" || r.prioritas === selectedPrioritas;
      const matchStatus =
        selectedStatus === "Semua Status" || r.status === selectedStatus;

      return matchSearch && matchPrioritas && matchStatus;
    });
  }, [rows, search, selectedPrioritas, selectedStatus]);

  // 3. Perhitungan Dinamis 4 Kartu KPI Makro & Fokus Hari Ini
  const metrics = useMemo(() => {
    const unresolved = rows.filter((r) => r.status !== "Selesai");

    const criticalItems = unresolved.filter((r) => r.prioritas === "Critical");
    const highItems = unresolved.filter((r) => r.prioritas === "High");
    const mediumItems = unresolved.filter((r) => r.prioritas === "Medium");
    const lowItems = unresolved.filter((r) => r.prioritas === "Low");

    const totalCriticalNominal = criticalItems.reduce((acc, curr) => acc + curr.nominalRaw, 0);
    const totalHighNominal = highItems.reduce((acc, curr) => acc + curr.nominalRaw, 0);
    const totalMediumNominal = mediumItems.reduce((acc, curr) => acc + curr.nominalRaw, 0);
    const totalLowNominal = lowItems.reduce((acc, curr) => acc + curr.nominalRaw, 0);

    const slaComplianceRate = rows.length > 0 ? Math.round(((rows.length - unresolved.filter(r => r.slaHours > 24).length) / rows.length) * 100) : 100;

    // 3 Fokus Teratas berdasarkan Nominal Tertinggi
    const topFocus = [...unresolved]
      .sort((a, b) => b.nominalRaw - a.nominalRaw)
      .slice(0, 3)
      .map((item, idx) => ({
        no: `0${idx + 1}`,
        customer: item.customer,
        label: `${item.prioritas} · ${item.slaHours} jam`,
        nominal: formatCompactRupiah(item.nominalRaw),
        badgeClass:
          item.prioritas === "Critical"
            ? "bg-rose-50 text-rose-600"
            : item.prioritas === "High"
            ? "bg-rose-50 text-rose-600"
            : "bg-amber-50 text-amber-700",
        raw: item,
      }));

    return {
      criticalCount: criticalItems.length,
      criticalNominal: formatCompactRupiah(totalCriticalNominal),
      highCount: highItems.length,
      highNominal: formatCompactRupiah(totalHighNominal),
      mediumCount: mediumItems.length,
      mediumNominal: formatCompactRupiah(totalMediumNominal),
      lowCount: lowItems.length,
      lowNominal: formatCompactRupiah(totalLowNominal),
      slaComplianceRate,
      resolvedCount: rows.filter((r) => r.status === "Selesai").length,
      totalCount: rows.length,
      topFocus,
    };
  }, [rows]);

  // 4. Update Status Transaksi Nyata ke Supabase
  const handleUpdateStatus = async (newStatus: ExceptionStatus) => {
    if (!activeItem) return;

    try {
      setIsSubmitting(true);
      const isResolved = newStatus === "Selesai";

      if (activeItem.dbId && !activeItem.dbId.startsWith("mock-")) {
        const { error } = await supabase
          .from("c2_cost_transactions")
          .update({
            review_flag: !isResolved,
            description: notes || `Telah ditinjau dengan status ${newStatus} oleh Kak Dian (Tax Manager)`,
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

  const renderPrioritasBadge = (prioritas: PriorityLevel) => {
    switch (prioritas) {
      case "Critical":
        return <span className="inline-block rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600">Critical</span>;
      case "High":
        return <span className="inline-block rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600">High</span>;
      case "Medium":
        return <span className="inline-block rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">Medium</span>;
      case "Low":
        return <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Low</span>;
    }
  };

  const renderStatusBadge = (status: ExceptionStatus) => {
    switch (status) {
      case "Terbuka":
        return <span className="inline-block rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-600">Terbuka</span>;
      case "Ditinjau":
        return <span className="inline-block rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">Ditinjau</span>;
      case "Dalam Proses":
        return <span className="inline-block rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-600">Dalam Proses</span>;
      case "Selesai":
        return <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">Selesai</span>;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f4f7fb]">
      <Sidebar />

      <main className="flex-1 px-8 py-7">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Priority Exception Dashboard
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Prioritas penyelesaian exception berdasarkan dampak finansial dan SLA PT Andima Transportindo
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchPriorityData}
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

        {/* Toast Notifikasi */}
        {toastMessage && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-bold text-emerald-900">{toastMessage}</p>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-950">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* 4 KPI Cards Dinamis Terkoneksi Supabase */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold tracking-wider text-slate-400">CRITICAL</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-500">
                <Flame className="h-4 w-4" />
              </div>
            </div>
            <h2 className="mt-2 text-2xl font-black text-slate-900">{metrics.criticalCount}</h2>
            <p className="mt-2 text-[11px] font-medium text-slate-400">{metrics.criticalNominal} · SLA terlewat</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold tracking-wider text-slate-400">HIGH</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-500">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <h2 className="mt-2 text-2xl font-black text-slate-900">{metrics.highCount}</h2>
            <p className="mt-2 text-[11px] font-medium text-slate-400">{metrics.highNominal} · kurang dari 24 jam</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold tracking-wider text-slate-400">MEDIUM</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <h2 className="mt-2 text-2xl font-black text-slate-900">{metrics.mediumCount}</h2>
            <p className="mt-2 text-[11px] font-medium text-slate-400">{metrics.mediumNominal} · dalam pemantauan</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold tracking-wider text-slate-400">LOW</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-500">
                <Info className="h-4 w-4" />
              </div>
            </div>
            <h2 className="mt-2 text-2xl font-black text-slate-900">{metrics.lowCount}</h2>
            <p className="mt-2 text-[11px] font-medium text-slate-400">{metrics.lowNominal} · risiko rendah</p>
          </div>
        </div>

        {/* Fokus Hari Ini & SLA Penyelesaian */}
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-9">
            <h3 className="text-sm font-bold text-slate-900">Fokus Hari Ini</h3>
            <p className="text-[11px] text-slate-400">Kasus anomali prioritas teratas berdasarkan nominal dampak risiko</p>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {metrics.topFocus.length === 0 ? (
                <div className="col-span-3 py-6 text-center text-xs text-slate-400">
                  Semua transaksi anomali telah selesai ditinjau.
                </div>
              ) : (
                metrics.topFocus.map((f) => (
                  <div
                    key={f.no}
                    onClick={() => {
                      setActiveItem(f.raw);
                      setNotes(f.raw.resolutionNotes || "");
                    }}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 transition hover:border-sky-300 hover:bg-white"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl font-extrabold text-slate-300 select-none shrink-0">
                        {f.no}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-800">{f.customer}</p>
                        <span className={`inline-block mt-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-bold ${f.badgeClass}`}>
                          {f.label}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-700 whitespace-nowrap ml-2">
                      {f.nominal}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3">
            <h3 className="text-sm font-bold text-slate-900">SLA Penyelesaian</h3>
            <p className="text-[11px] text-slate-400">September 2026</p>

            <div className="mt-4 flex items-center gap-3">
              <span className="text-4xl font-black text-emerald-600">
                {metrics.slaComplianceRate}%
              </span>
              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                Target 90%
              </span>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              {metrics.resolvedCount} dari {metrics.totalCount} exception terselesaikan.
            </p>
          </div>
        </div>

        {/* Tabel Daftar Exception Berdasarkan Prioritas */}
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Daftar Exception Berdasarkan Prioritas
              </h3>
              <p className="text-[11px] text-slate-400">Tersinkronisasi langsung dengan tabel c2_cost_transactions</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari customer, job, atau voucher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-56 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                />
              </div>

              <select
                value={selectedPrioritas}
                onChange={(e) => setSelectedPrioritas(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400"
              >
                <option value="Semua Prioritas">Semua Prioritas</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400"
              >
                <option value="Semua Status">Semua Status</option>
                <option value="Terbuka">Terbuka</option>
                <option value="Ditinjau">Ditinjau</option>
                <option value="Dalam Proses">Dalam Proses</option>
                <option value="Selesai">Selesai</option>
              </select>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pr-4">CUSTOMER</th>
                  <th className="pb-3 pr-4">NOMOR JOB</th>
                  <th className="pb-3 pr-4">MASALAH ANOMALI</th>
                  <th className="pb-3 pr-4">NOMINAL AKTUAL</th>
                  <th className="pb-3 pr-4">VARIANCE</th>
                  <th className="pb-3 pr-4 text-center">PRIORITAS</th>
                  <th className="pb-3 pr-4 text-center">STATUS</th>
                  <th className="pb-3 text-center">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                        <span>Menghubungkan ke basis data Supabase...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400">
                      Tidak ada anomali yang sesuai dengan pencarian atau filter.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 pr-4 font-bold text-slate-800">{r.customer}</td>
                      <td className="py-3.5 pr-4 font-mono font-semibold text-slate-600">
                        {r.jobNumber === "UNMATCHED" || r.jobNumber.includes("UNKNOWN") ? (
                          <span className="text-amber-600 font-bold">UNMATCHED</span>
                        ) : (
                          r.jobNumber
                        )}
                      </td>
                      <td className="py-3.5 pr-4 text-slate-600">{r.masalah}</td>
                      <td className="py-3.5 pr-4 font-medium text-slate-800">{r.nominal}</td>
                      <td className="py-3.5 pr-4 font-semibold text-rose-600">{r.variance}</td>
                      <td className="py-3.5 pr-4 text-center">{renderPrioritasBadge(r.prioritas)}</td>
                      <td className="py-3.5 pr-4 text-center">{renderStatusBadge(r.status)}</td>
                      <td className="py-3.5 text-center">
                        <button
                          onClick={() => {
                            setActiveItem(r);
                            setNotes(r.resolutionNotes || "");
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
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

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <p className="text-[11px] text-slate-400">
              Menampilkan {filteredRows.length} dari {rows.length} exception aktif
            </p>
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-600">
              Live Realtime Supabase
            </span>
          </div>
        </div>

        {/* Modal Lihat Detail & Tindak Lanjut Nyata */}
        {activeItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">{activeItem.customer}</h3>
                  <p className="text-xs text-slate-400">{activeItem.id} · No. Voucher: {activeItem.voucherNo}</p>
                </div>
                <button
                  onClick={() => setActiveItem(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-2.5 rounded-xl bg-slate-50 p-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nomor Job:</span>
                  <span className="font-mono font-bold text-slate-800">{activeItem.jobNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Keterangan Masalah:</span>
                  <span className="font-medium text-slate-800">{activeItem.masalah}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nominal Aktual:</span>
                  <span className="font-bold text-slate-900">{activeItem.nominal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Deviasi (Variance):</span>
                  <span className="font-bold text-rose-600">{activeItem.variance}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200/60 pt-2">
                  <span className="text-slate-500">Prioritas & SLA:</span>
                  <span className="font-bold text-slate-800">{activeItem.prioritas} · {activeItem.slaHours} Jam</span>
                </div>
              </div>

              {/* Input Textarea Catatan Justifikasi */}
              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-700">
                  Catatan Justifikasi / Audit Trail
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Masukkan catatan peninjauan Kak Dian..."
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                />
              </div>

              {/* Tombol Aksi Transisi Status */}
              <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => setActiveItem(null)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Tutup
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