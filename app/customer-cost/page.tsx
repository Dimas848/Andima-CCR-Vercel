"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Download,
  CreditCard,
  Landmark,
  TrendingUp,
  AlertCircle,
  FileText,
  Eye,
  ChevronRight,
  X,
  ExternalLink,
  ShieldCheck,
  Search,
  SlidersHorizontal,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

import Sidebar from "@/components/sidebar";
import CustomDropdown, { DropdownOption } from "../dashboard/CustomDropdown";
import { supabase } from "@/lib/supabase";

export interface DokumenBukti {
  id: string;
  nama: string;
  tanggal: string;
  ukuran: string;
  tipe: "pdf" | "jpg" | "png";
  url: string;
}

export interface CustomerTransaction {
  id: string;
  dbId: string;
  tanggal: string;
  kategori: string;
  deskripsi: string;
  nominal: number;
  status: "Valid" | "Exception" | "Ditinjau";
  hasEvidence: boolean;
  evidenceUrl?: string | null;
}

export interface CustomerSummaryItem {
  idCustomer: string;
  namaCustomer: string;
  segmen: string;
  totalCost: number;
  budget: number | null;
  variance: number | null;
  exceptionCount: number;
  status: string;
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

function formatRupiah(val: number): string {
  return `Rp ${val.toLocaleString("id-ID")}`;
}

function formatJt(val: number): string {
  if (Math.abs(val) >= 1_000_000_000) {
    return `Rp ${(val / 1_000_000_000).toLocaleString("id-ID", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} M`;
  }
  return `Rp ${(val / 1_000_000).toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} jt`;
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
                    <p className="mt-1 text-sm font-bold text-slate-900">{formatJt(cat.nominal)}</p>
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
// KOMPONEN UTAMA: CUSTOMER COST BREAKDOWN
// =========================================================================
export default function CustomerCostPage() {
  const router = useRouter();
  const currentLivePeriod = useMemo(() => getDynamicPeriod(0), []);

  // State Pelanggan & Periode
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("—");
  const [periode, setPeriode] = useState<string>("Semua Periode");

  // State Kontrol Loading
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // State Modal Pratinjau Dokumen
  const [previewDoc, setPreviewDoc] = useState<DokumenBukti | null>(null);
  const [isAllDocsModalOpen, setIsAllDocsModalOpen] = useState(false);

  // Filter Tables
  const [searchCustomer, setSearchCustomer] = useState("");
  const [filterCustomerStatus, setFilterCustomerStatus] = useState("Semua Status");
  const [filterCustomerSegmen, setFilterCustomerSegmen] = useState("Semua Segmen");
  const [customerPage, setCustomerPage] = useState(1);

  const [filterTrxCategory, setFilterTrxCategory] = useState("Semua Kategori");
  const [trxPage, setTrxPage] = useState(1);
  const trxPerPage = 6;

  // State Data Dinamis
  const [rawTransactions, setRawTransactions] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<CustomerSummaryItem[]>([]);
  const [transactionsList, setTransactionsList] = useState<CustomerTransaction[]>([]);
  const [documentsList, setDocumentsList] = useState<DokumenBukti[]>([]);

  // Opsi Dropdown Periode Dinamis dari Database
  const dynamicPeriodeOptions: DropdownOption[] = useMemo(() => {
    const list: DropdownOption[] = [{ value: "Semua Periode", label: "Semua Periode" }];
    const periodsFromDb = Array.from(new Set(rawTransactions.map((t) => t.period_month).filter(Boolean)));
    
    if (periodsFromDb.length > 0) {
      periodsFromDb.forEach((p) => list.push({ value: p, label: p }));
    } else {
      list.push(
        { value: getDynamicPeriod(0), label: getDynamicPeriod(0) },
        { value: getDynamicPeriod(1), label: getDynamicPeriod(1) }
      );
    }
    return list;
  }, [rawTransactions]);

  // Tarik Data Nyata dari Supabase View c2_cost_transactions
  const fetchCustomerDataFromSupabase = useCallback(async () => {
    try {
      setIsSyncing(true);
      const { data, error } = await supabase
        .from("c2_cost_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !data || data.length === 0) {
        setCustomersList([]);
        setTransactionsList([]);
        setDocumentsList([]);
        setRawTransactions([]);
        setSelectedCustomer("");
        setSelectedCustomerId("—");
        return;
      }

      setRawTransactions(data);

      // Agregasi Data per Pelanggan
      const map = new Map<string, {
        idCustomer: string;
        total: number;
        planned: number;
        variance: number;
        exceptions: number;
        count: number;
      }>();

      data.forEach((t, idx) => {
        const name = t.customer_name || "Tanpa Nama";
        const actual = Number(t.actual_cost || 0);
        const planned = Number(t.planned_cost || 0);
        const variance = Number(t.variance || (actual - planned) || 0);
        const isExc = Boolean(t.review_flag || variance > 0 || !t.has_evidence || !t.is_job_matched);

        const curr = map.get(name) || {
          idCustomer: t.customer_id ? `CUST-${String(t.customer_id).padStart(4, "0")}` : `CUST-${String(idx + 1).padStart(4, "0")}`,
          total: 0,
          planned: 0,
          variance: 0,
          exceptions: 0,
          count: 0,
        };

        map.set(name, {
          idCustomer: curr.idCustomer,
          total: curr.total + actual,
          planned: curr.planned + planned,
          variance: curr.variance + variance,
          exceptions: curr.exceptions + (isExc ? 1 : 0),
          count: curr.count + 1,
        });
      });

      const aggregated: CustomerSummaryItem[] = Array.from(map.entries()).map(([name, stat]) => ({
        idCustomer: stat.idCustomer,
        namaCustomer: name,
        segmen: name.toLowerCase().includes("retail") ? "Retail" : "Logistik",
        totalCost: stat.total,
        budget: stat.planned > 0 ? stat.planned : null,
        variance: stat.planned > 0 ? stat.total - stat.planned : null,
        exceptionCount: stat.exceptions,
        status: "Aktif",
      }));

      setCustomersList(aggregated);

      // Tetapkan Customer Pertama Secara Otomatis jika Belum Ada yang Terpilih
      setSelectedCustomer((prev) => {
        if (prev && map.has(prev)) return prev;
        return aggregated[0]?.namaCustomer || "";
      });

    } catch (err) {
      console.error(err);
      setCustomersList([]);
      setTransactionsList([]);
      setDocumentsList([]);
      setRawTransactions([]);
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomerDataFromSupabase();
  }, [fetchCustomerDataFromSupabase]);

  // Sinkronkan Transaksi & Dokumen Berdasarkan Customer & Periode Terpilih
  useEffect(() => {
    if (!selectedCustomer || rawTransactions.length === 0) {
      setTransactionsList([]);
      setDocumentsList([]);
      return;
    }

    // Perbarui ID Customer yang ditampilkan
    const foundCust = customersList.find((c) => c.namaCustomer === selectedCustomer);
    if (foundCust) setSelectedCustomerId(foundCust.idCustomer);

    // Filter transaksi untuk customer aktif (dengan toleransi filter periode jika dipilih)
    const custTrx = rawTransactions.filter((t) => {
      const matchName = (t.customer_name || "").toLowerCase() === selectedCustomer.toLowerCase();
      const matchPeriod = periode === "Semua Periode" || t.period_month === periode;
      return matchName && matchPeriod;
    });

    const mappedTrx: CustomerTransaction[] = custTrx.map((t, idx) => {
      const actual = Number(t.actual_cost || 0);
      const planned = Number(t.planned_cost || 0);
      const variance = Number(t.variance || (actual - planned) || 0);
      const isExc = Boolean(t.review_flag || variance > 0 || !t.has_evidence || !t.is_job_matched);

      let cat = "Operasional";
      const rawCat = (t.cost_category || "").toUpperCase();
      if (rawCat.includes("TRUCK") || rawCat.includes("TRANSPORT")) cat = "Transportasi";
      else if (rawCat.includes("STORAGE") || rawCat.includes("WAREHOUSE") || rawCat.includes("GUDANG")) cat = "Gudang & Distribusi";
      else if (rawCat.includes("HANDL")) cat = "Handling Terminal";
      else if (rawCat.includes("PROMO")) cat = "Promosi";

      return {
        id: t.voucher_no || t.code || `TRX-${String(idx + 1).padStart(4, "0")}`,
        dbId: String(t.id || `trx-row-${idx}`),
        tanggal: new Date(t.created_at || Date.now()).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        kategori: cat,
        deskripsi: t.description || `Biaya operasional ${t.job_number || "-"}`,
        nominal: actual,
        status: isExc ? "Exception" : t.review_flag ? "Ditinjau" : "Valid",
        hasEvidence: Boolean(t.has_evidence),
        evidenceUrl: t.evidence_url || null,
      };
    });

    setTransactionsList(mappedTrx);

    // Filter dokumen bukti transaksi nyata dari customer terpilih
    const docs: DokumenBukti[] = custTrx
      .filter((t) => t.has_evidence || t.evidence_url)
      .map((t, idx) => ({
        id: `doc-${t.id || idx}`,
        nama: `kuitansi_${(t.voucher_no || t.job_number || `trx_${idx + 1}`).toLowerCase().replace(/[^a-z0-9_-]/g, "_")}.pdf`,
        tanggal: new Date(t.created_at || Date.now()).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        ukuran: "1.4 MB",
        tipe: "pdf",
        url: t.evidence_url || "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      }));

    setDocumentsList(docs);
  }, [selectedCustomer, periode, rawTransactions, customersList]);

  // Dropdown Customer Options
  const customerDropdownOptions: DropdownOption[] = useMemo(() => {
    return customersList.map((c) => ({
      value: c.namaCustomer,
      label: c.namaCustomer,
    }));
  }, [customersList]);

  // Kalkulasi 4 KPI Customer Terpilih
  const currentCustData = useMemo(() => {
    const totalCost = transactionsList.reduce((sum, t) => sum + t.nominal, 0);
    const countTrx = transactionsList.length;
    const excCount = transactionsList.filter((t) => t.status === "Exception").length;

    // Hitung budget & variance customer terpilih
    const found = customersList.find((c) => c.namaCustomer === selectedCustomer);
    const budget = found?.budget || totalCost;
    const variance = totalCost - budget;
    const variancePctNum = budget > 0 ? (variance / budget) * 100 : 0;
    const realisasiNum = budget > 0 ? Math.round((totalCost / budget) * 100) : 100;

    return {
      totalCostFormatted: formatJt(totalCost),
      budgetFormatted: budget > 0 ? formatJt(budget) : "Rp 0",
      varianceFormatted: variance >= 0 ? `+${formatJt(variance)}` : formatJt(variance),
      variancePct: `${variancePctNum >= 0 ? "+" : ""}${variancePctNum.toFixed(1).replace(".", ",")}%`,
      realisasiText: budget > 0 ? `Realisasi ${realisasiNum}%` : "Sesuai pagu",
      trxCountText: `${countTrx} transaksi`,
      exceptionCount: excCount,
      exceptionText: excCount > 0 ? `${excCount} transaksi anomali` : "Semua transaksi valid",
    };
  }, [customersList, selectedCustomer, transactionsList]);

  // Kalkulasi Breakdown Kategori Biaya Customer Terpilih
  const categoryBreakdown = useMemo(() => {
    const totals: Record<string, number> = {
      Transportasi: 0,
      "Gudang & Distribusi": 0,
      "Handling Terminal": 0,
      Operasional: 0,
      Promosi: 0,
    };

    let grandTotal = 0;
    transactionsList.forEach((t) => {
      const cat = totals[t.kategori] !== undefined ? t.kategori : "Operasional";
      totals[cat] += t.nominal;
      grandTotal += t.nominal;
    });

    return [
      { label: "Transportasi", color: "bg-[#0a7ebf]", amount: totals.Transportasi, pct: grandTotal > 0 ? Math.round((totals.Transportasi / grandTotal) * 100) : 0 },
      { label: "Gudang & Distribusi", color: "bg-[#d4194f]", amount: totals["Gudang & Distribusi"], pct: grandTotal > 0 ? Math.round((totals["Gudang & Distribusi"] / grandTotal) * 100) : 0 },
      { label: "Handling Terminal", color: "bg-[#7c3aed]", amount: totals["Handling Terminal"], pct: grandTotal > 0 ? Math.round((totals["Handling Terminal"] / grandTotal) * 100) : 0 },
      { label: "Operasional", color: "bg-[#10b981]", amount: totals.Operasional, pct: grandTotal > 0 ? Math.round((totals.Operasional / grandTotal) * 100) : 0 },
      { label: "Promosi", color: "bg-[#d97706]", amount: totals.Promosi, pct: grandTotal > 0 ? Math.round((totals.Promosi / grandTotal) * 100) : 0 },
    ];
  }, [transactionsList]);

  // Notifikasi Kategori Dinamis
  const notificationCategories = useMemo(() => {
    const list = [];
    const overBudget = rawTransactions.filter((r) => Number(r.variance || 0) > 0);
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

    const highCost = rawTransactions.filter((r) => Number(r.actual_cost || 0) >= 50_000_000);
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

    const missingEvidence = rawTransactions.filter((r) => !r.has_evidence);
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
  }, [rawTransactions]);

  // Filter Tabel Customer
  const filteredCustomers = useMemo(() => {
    return customersList.filter((c) => {
      const matchSearch = c.namaCustomer.toLowerCase().includes(searchCustomer.toLowerCase()) ||
        c.idCustomer.toLowerCase().includes(searchCustomer.toLowerCase());
      const matchStatus = filterCustomerStatus === "Semua Status" || c.status === filterCustomerStatus;
      const matchSegmen = filterCustomerSegmen === "Semua Segmen" || c.segmen === filterCustomerSegmen;
      return matchSearch && matchStatus && matchSegmen;
    });
  }, [customersList, searchCustomer, filterCustomerStatus, filterCustomerSegmen]);

  // Filter Tabel Transaksi Terbaru
  const filteredRecentTransactions = useMemo(() => {
    if (filterTrxCategory === "Semua Kategori") return transactionsList;
    return transactionsList.filter((t) => t.kategori === filterTrxCategory);
  }, [transactionsList, filterTrxCategory]);

  const totalTrxPages = Math.max(1, Math.ceil(filteredRecentTransactions.length / trxPerPage));
  const displayedRecentTransactions = useMemo(() => {
    const start = (trxPage - 1) * trxPerPage;
    return filteredRecentTransactions.slice(start, start + trxPerPage);
  }, [filteredRecentTransactions, trxPage, trxPerPage]);

  // Handler Unduh Detail CSV
  const handleDownloadDetail = () => {
    if (transactionsList.length === 0) return;
    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [
        "id_transaksi,customer,tanggal,kategori,deskripsi,nominal,status",
        ...transactionsList.map(
          (t) => `"${t.id}","${selectedCustomer}","${t.tanggal}","${t.kategori}","${t.deskripsi.replace(/"/g, '""')}",${t.nominal},"${t.status}"`
        ),
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Detail_Cost_${(selectedCustomer || "Customer").replace(/\s+/g, "_")}_${periode.replace(/\s+/g, "_")}.csv`);
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
              Customer Cost Breakdown
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">
              Detail biaya dan transaksi {selectedCustomer || "pelanggan"}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Tombol Sinkronkan Supabase */}
            <button
              onClick={fetchCustomerDataFromSupabase}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <SlidersHorizontal className={`h-3.5 w-3.5 text-slate-600 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Menyinkronkan..." : "Sinkronkan Supabase"}</span>
            </button>

            {/* Tombol Unduh Detail */}
            <button
              onClick={handleDownloadDetail}
              disabled={transactionsList.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5 text-slate-600" />
              <span>Unduh Detail</span>
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
                {rawTransactions.length > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
                )}
              </button>

              <NotificationPopover
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
                periode={periode}
                isLoading={isLoading}
                totalExceptions={rawTransactions.filter((r) => r.review_flag || r.variance > 0).length}
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

        {/* Filter Bar Parameter Pelanggan */}
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <div className="w-72">
            {isLoading ? (
              <div className="h-[58px] rounded-lg bg-slate-200 animate-pulse" />
            ) : (
              <CustomDropdown
                label="Customer"
                value={selectedCustomer}
                options={customerDropdownOptions}
                onChange={(val) => {
                  setSelectedCustomer(val);
                  setTrxPage(1);
                }}
              />
            )}
          </div>

          <div className="w-52">
            {isLoading ? (
              <div className="h-[58px] rounded-lg bg-slate-200 animate-pulse" />
            ) : (
              <CustomDropdown
                label="Periode"
                value={periode}
                options={dynamicPeriodeOptions}
                onChange={(val) => {
                  setPeriode(val);
                  setTrxPage(1);
                }}
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-400">ID CUSTOMER</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={selectedCustomerId}
                className="h-[38px] w-32 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-800 shadow-sm outline-none"
              />
              <span className="inline-flex h-[38px] items-center rounded-lg bg-[#ecfdf5] px-3 text-xs font-bold text-[#059669]">
                Customer Aktif
              </span>
            </div>
          </div>
        </div>

        {/* 4 Kartu KPI Makro */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
                <div className="flex items-start justify-between">
                  <div className="h-3 w-20 rounded bg-slate-200" />
                  <div className="h-7 w-7 rounded-lg bg-slate-200" />
                </div>
                <div className="mt-3 h-7 w-24 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-32 rounded bg-slate-100" />
              </div>
            ))
          ) : (
            <>
              {/* TOTAL COST */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    TOTAL COST
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e0f2fe] text-[#0a7ebf]">
                    <CreditCard className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">
                    {currentCustData.totalCostFormatted}
                  </h2>
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-[#ffe4e6] text-[#e11d48]">
                    {currentCustData.variancePct}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {currentCustData.trxCountText}
                </p>
              </div>

              {/* BUDGET */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    BUDGET
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#dcfce7] text-[#16a34a]">
                    <Landmark className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-xl font-bold text-slate-900">
                    {currentCustData.budgetFormatted}
                  </h2>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {currentCustData.realisasiText}
                </p>
              </div>

              {/* VARIANCE */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400">
                    VARIANCE
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ffe4e6] text-[#e11d48]">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-xl font-bold text-slate-900">
                    {currentCustData.varianceFormatted}
                  </h2>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Di atas budget
                </p>
              </div>

              {/* EXCEPTION */}
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
                    {currentCustData.exceptionCount}
                  </h2>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {currentCustData.exceptionText}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Baris 2: Breakdown Kategori & Dokumen Bukti */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          {/* Breakdown Kategori Biaya */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-7">
            <h3 className="text-sm font-bold text-slate-900">Breakdown Kategori Biaya</h3>
            <p className="text-[11px] text-slate-400">Proporsi total cost customer ({selectedCustomer})</p>

            <div className="mt-5 space-y-3.5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-4 animate-pulse">
                    <div className="h-3 w-32 rounded bg-slate-200" />
                    <div className="h-2 flex-1 rounded-full bg-slate-100" />
                    <div className="h-3 w-16 rounded bg-slate-200" />
                  </div>
                ))
              ) : (
                categoryBreakdown.map((cat) => (
                  <div key={cat.label} className="flex items-center justify-between gap-4">
                    <span className="w-36 text-xs font-semibold text-slate-700">{cat.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-2 rounded-full ${cat.color} transition-all duration-300`} style={{ width: `${cat.pct}%` }} />
                    </div>
                    <span className="w-20 text-right text-xs font-bold text-slate-900">
                      {formatJt(cat.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Dokumen Bukti */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-5 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Dokumen Bukti</h3>
                  <p className="text-[11px] text-slate-400">{documentsList.length} dokumen pada transaksi ini</p>
                </div>
                <button
                  disabled={documentsList.length === 0}
                  onClick={() => setIsAllDocsModalOpen(true)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  Lihat Semua
                </button>
              </div>

              <div className="mt-4 space-y-2.5">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100 animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-slate-200" />
                        <div className="space-y-1.5">
                          <div className="h-3.5 w-32 rounded bg-slate-200" />
                          <div className="h-2.5 w-24 rounded bg-slate-100" />
                        </div>
                      </div>
                      <div className="h-5 w-5 rounded bg-slate-200" />
                    </div>
                  ))
                ) : documentsList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Belum ada lampiran dokumen untuk transaksi pelanggan ini.
                  </div>
                ) : (
                  documentsList.slice(0, 3).map((doc, idx) => (
                    <div
                      key={doc.id || `doc-${idx}`}
                      className="flex items-center justify-between rounded-xl bg-slate-50/80 p-3 border border-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            idx % 2 === 0 ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                          }`}
                        >
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 truncate max-w-[190px]">{doc.nama}</p>
                          <p className="text-[11px] text-slate-400">
                            {doc.tanggal} · {doc.ukuran}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        title="Lihat Bukti"
                        className="p-1.5 text-sky-600 hover:text-sky-800 transition cursor-pointer"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Baris 3: Tabel Daftar Customer */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Daftar Customer</h3>
              <p className="text-[11px] text-slate-400">
                Pilih customer untuk melihat detail breakdown di atas
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-700" />
                <input
                  type="text"
                  placeholder="Cari customer atau ID..."
                  value={searchCustomer}
                  onChange={(e) => {
                    setSearchCustomer(e.target.value);
                    setCustomerPage(1);
                  }}
                  className="w-56 rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs font-medium text-slate-900 placeholder:text-slate-500 outline-none focus:border-[#0a7ebf] focus:ring-1 focus:ring-[#0a7ebf]"
                />
              </div>

              <select
                value={filterCustomerStatus}
                onChange={(e) => {
                  setFilterCustomerStatus(e.target.value);
                  setCustomerPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#0a7ebf]"
              >
                <option value="Semua Status">Semua Status</option>
                <option value="Aktif">Aktif</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>

              <select
                value={filterCustomerSegmen}
                onChange={(e) => {
                  setFilterCustomerSegmen(e.target.value);
                  setCustomerPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#0a7ebf]"
              >
                <option value="Semua Segmen">Semua Segmen</option>
                <option value="Retail">Retail</option>
                <option value="Logistik">Logistik</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400">
                  <th className="py-3 px-3">ID CUSTOMER</th>
                  <th className="py-3 px-3">NAMA CUSTOMER</th>
                  <th className="py-3 px-3">SEGMEN</th>
                  <th className="py-3 px-3">TOTAL COST</th>
                  <th className="py-3 px-3">BUDGET</th>
                  <th className="py-3 px-3">VARIANCE</th>
                  <th className="py-3 px-3">EXCEPTION</th>
                  <th className="py-3 px-3">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-3.5 px-3"><div className="h-3.5 w-20 rounded bg-slate-200" /></td>
                      <td className="py-3.5 px-3"><div className="h-3.5 w-32 rounded bg-slate-200" /></td>
                      <td className="py-3.5 px-3"><div className="h-3.5 w-16 rounded bg-slate-200" /></td>
                      <td className="py-3.5 px-3"><div className="h-3.5 w-24 rounded bg-slate-200" /></td>
                      <td className="py-3.5 px-3"><div className="h-3.5 w-20 rounded bg-slate-200" /></td>
                      <td className="py-3.5 px-3"><div className="h-3.5 w-16 rounded bg-slate-200" /></td>
                      <td className="py-3.5 px-3"><div className="h-4 w-12 rounded bg-slate-200" /></td>
                      <td className="py-3.5 px-3"><div className="h-4 w-12 rounded bg-slate-200" /></td>
                    </tr>
                  ))
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-xs text-slate-400">
                      Tidak ada data customer yang cocok.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.slice((customerPage - 1) * 4, customerPage * 4).map((row, idx) => (
                    <tr
                      key={row.idCustomer !== "—" ? `${row.idCustomer}-${row.namaCustomer}` : `cust-row-${idx}`}
                      onClick={() => {
                        setSelectedCustomer(row.namaCustomer);
                        setSelectedCustomerId(row.idCustomer);
                        setTrxPage(1);
                      }}
                      className={`cursor-pointer transition hover:bg-slate-50/70 ${
                        selectedCustomer === row.namaCustomer ? "bg-sky-50/60 font-semibold" : ""
                      }`}
                    >
                      <td className="py-3.5 px-3 font-mono font-bold text-[#0a7ebf]">
                        {row.idCustomer}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-slate-900">
                        {row.namaCustomer}
                      </td>
                      <td className="py-3.5 px-3 text-slate-400">
                        {row.segmen}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-slate-900">
                        {formatJt(row.totalCost)}
                      </td>
                      <td className="py-3.5 px-3 text-slate-700">
                        {row.budget ? formatJt(row.budget) : "—"}
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-[#e11d48]">
                        {row.variance ? `+${formatJt(row.variance)}` : "—"}
                      </td>
                      <td className="py-3.5 px-3">
                        {row.exceptionCount > 0 ? (
                          <span className="rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-[10px] font-bold text-[#d97706]">
                            {row.exceptionCount} item
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-[#10b981]">
                        {row.status || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Menampilkan {filteredCustomers.length > 0 ? (customerPage - 1) * 4 + 1 : 0}–
              {Math.min(customerPage * 4, filteredCustomers.length)} dari {filteredCustomers.length} customer
            </p>

            <div className="flex items-center rounded-full border border-sky-400/80 bg-white px-3 py-1 gap-2.5 shadow-xs">
              {Array.from({ length: Math.max(1, Math.ceil(filteredCustomers.length / 4)) }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  onClick={() => setCustomerPage(num)}
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold transition ${
                    customerPage === num
                      ? "bg-[#0a7ebf] text-white font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Baris 4: Tabel Transaksi Terbaru (Tepat 6 Baris per Halaman) */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Transaksi Terbaru</h3>
              <p className="text-[11px] text-slate-400">
                Transaksi terkait {selectedCustomer || "pelanggan"}
              </p>
            </div>

            <select
              value={filterTrxCategory}
              onChange={(e) => {
                setFilterTrxCategory(e.target.value);
                setTrxPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#0a7ebf]"
            >
              <option value="Semua Kategori">Semua Kategori</option>
              <option value="Transportasi">Transportasi</option>
              <option value="Gudang & Distribusi">Gudang & Distribusi</option>
              <option value="Handling Terminal">Handling Terminal</option>
              <option value="Operasional">Operasional</option>
              <option value="Promosi">Promosi</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400">
                  <th className="py-3 px-3">ID TRANSAKSI</th>
                  <th className="py-3 px-3">TANGGAL</th>
                  <th className="py-3 px-3">KATEGORI</th>
                  <th className="py-3 px-3">DESKRIPSI</th>
                  <th className="py-3 px-3">NOMINAL</th>
                  <th className="py-3 px-3 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-3.5 px-3"><div className="h-3.5 w-24 rounded bg-slate-200" /></td>
                      <td className="py-3.5 px-3"><div className="h-3.5 w-20 rounded bg-slate-200" /></td>
                      <td className="py-3.5 px-3"><div className="h-3.5 w-20 rounded bg-slate-200" /></td>
                      <td className="py-3.5 px-3"><div className="h-3.5 w-48 rounded bg-slate-200" /></td>
                      <td className="py-3.5 px-3"><div className="h-3.5 w-24 rounded bg-slate-200" /></td>
                      <td className="py-3.5 px-3"><div className="mx-auto h-4 w-16 rounded-full bg-slate-200" /></td>
                    </tr>
                  ))
                ) : displayedRecentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-xs text-slate-400">
                      Tidak ada transaksi ditemukan untuk customer ini.
                    </td>
                  </tr>
                ) : (
                  displayedRecentTransactions.map((row, idx) => (
                    <tr 
                      key={row.dbId || `${row.id}-${idx}`} 
                      className="hover:bg-slate-50/60 transition"
                    >
                      <td className="py-3.5 px-3 font-mono font-medium text-slate-600">
                        {row.id}
                      </td>
                      <td className="py-3.5 px-3 text-slate-700">
                        {row.tanggal}
                      </td>
                      <td className="py-3.5 px-3 text-slate-800">
                        {row.kategori}
                      </td>
                      <td className="py-3.5 px-3 font-medium text-slate-800">
                        {row.deskripsi}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-slate-900">
                        {formatRupiah(row.nominal)}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-block rounded-full px-3 py-0.5 text-[11px] font-semibold ${
                            row.status === "Valid"
                              ? "bg-[#dcfce7] text-[#16a34a]"
                              : row.status === "Exception"
                              ? "bg-[#ffe4e6] text-[#e11d48]"
                              : "bg-[#fef3c7] text-[#d97706]"
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

          {/* Footer Paginasi Transaksi: 6 Baris per Halaman */}
          <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Menampilkan {filteredRecentTransactions.length > 0 ? (trxPage - 1) * trxPerPage + 1 : 0}–
              {Math.min(trxPage * trxPerPage, filteredRecentTransactions.length)} dari {filteredRecentTransactions.length} transaksi
            </p>

            <div className="flex items-center rounded-full border border-sky-400/80 bg-white px-3 py-1 gap-2.5 shadow-xs">
              {Array.from({ length: totalTrxPages }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  onClick={() => setTrxPage(num)}
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold transition ${
                    trxPage === num
                      ? "bg-[#0a7ebf] text-white font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {num}
                </button>
              ))}

              <button
                disabled={trxPage >= totalTrxPages}
                onClick={() => setTrxPage((p) => Math.min(p + 1, totalTrxPages))}
                className="text-[#0a7ebf] transition hover:text-[#08689d] disabled:opacity-30 ml-0.5"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="h-3.5 w-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Pratinjau Dokumen Bukti */}
        {previewDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="flex h-[82vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-[#0a7ebf]">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{previewDoc.nama}</h3>
                    <p className="text-[11px] text-slate-400">{previewDoc.ukuran} · {previewDoc.tanggal}</p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-1 items-center justify-center bg-slate-100/70 p-6 overflow-auto">
                {previewDoc.url.endsWith(".pdf") ? (
                  <iframe
                    src={previewDoc.url}
                    title={previewDoc.nama}
                    className="h-full w-full rounded-lg border border-slate-200 bg-white shadow"
                  />
                ) : (
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.nama}
                    className="max-h-full max-w-full rounded-lg border border-slate-200 bg-white object-contain shadow"
                  />
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-3 text-xs">
                <span className="text-slate-400">Lampiran Dokumen Transaksi Sah</span>
                <div className="flex items-center gap-2">
                  <a
                    href={previewDoc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Buka Tab Baru <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={() => setPreviewDoc(null)}
                    className="rounded-lg bg-[#0a7ebf] px-4 py-1.5 font-bold text-white shadow-sm hover:bg-[#08689d]"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Lihat Semua Dokumen */}
        {isAllDocsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="flex h-[75vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Seluruh Dokumen Bukti</h3>
                  <p className="text-[11px] text-slate-400">{selectedCustomer} · Periode {periode}</p>
                </div>
                <button
                  onClick={() => setIsAllDocsModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {documentsList.map((d, i) => (
                  <div
                    key={d.id || `doc-modal-${i}`}
                    className="flex items-center justify-between rounded-xl bg-slate-50 p-3.5 border border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                          i % 2 === 0 ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                        }`}
                      >
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{d.nama}</p>
                        <p className="text-[11px] text-slate-400">{d.tanggal} · {d.ukuran}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setIsAllDocsModalOpen(false);
                        setPreviewDoc(d);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-sky-600 hover:bg-sky-50 shadow-sm cursor-pointer"
                    >
                      Buka Bukti
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end border-t border-slate-100 p-3.5 bg-slate-50">
                <button
                  onClick={() => setIsAllDocsModalOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}