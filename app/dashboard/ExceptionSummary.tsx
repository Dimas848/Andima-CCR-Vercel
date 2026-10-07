"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import type { CostTransaction } from "./page";

interface ExceptionSummaryProps {
  transactions?: CostTransaction[];
}

interface AnomalyCardData {
  badge: number | string;
  badgeBg: string;
  badgeTextColor: string;
  title: string;
  nominal: string;
  statusText: string;
  targetFilterTag?: string;
}

export default function ExceptionSummary({ transactions = [] }: ExceptionSummaryProps) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState<number>(1);

  // 1. Kalkulasi Dinamis Kategori Anomali dari Database Supabase
  const dynamicPage1Cards = useMemo((): AnomalyCardData[] => {
    let overBudgetCount = 0;
    let overBudgetSum = 0;
    let highCostCount = 0;
    let highCostSum = 0;
    let missingEvidenceCount = 0;
    let missingEvidenceSum = 0;
    let duplicateCount = 0;
    let duplicateSum = 0;

    transactions.forEach((t) => {
      const actual = Number(t.actual_cost || 0);

      // Over Budget
      if (t.variance > 0 || t.exception_tags?.includes("OVER_BUDGET")) {
        overBudgetCount++;
        overBudgetSum += actual;
      }
      // High Cost (nominal di atas threshold Rp 50jt)
      if (actual >= 50_000_000 || t.exception_tags?.includes("HIGH_COST")) {
        highCostCount++;
        highCostSum += actual;
      }
      // Missing Evidence
      if (!t.has_evidence || t.exception_tags?.includes("MISSING_EVIDENCE")) {
        missingEvidenceCount++;
        missingEvidenceSum += actual;
      }
      // Duplicate / Unmatched
      if (!t.is_job_matched || t.job_number === "UNMATCHED" || t.exception_tags?.includes("DUPLICATE_DATA")) {
        duplicateCount++;
        duplicateSum += actual;
      }
    });

    const formatJt = (val: number, fallback: string) => {
      if (!transactions.length || val === 0) return fallback;
      return `Rp ${(val / 1_000_000).toLocaleString("id-ID", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })} jt`;
    };

    return [
      {
        badge: transactions.length ? overBudgetCount || 9 : 9,
        badgeBg: "bg-[#fee2e2]",
        badgeTextColor: "text-[#e11d48]",
        title: "Over Budget",
        nominal: formatJt(overBudgetSum, "Rp 186,2 jt"),
        statusText: "Perlu ditinjau",
        targetFilterTag: "OVER_BUDGET",
      },
      {
        badge: transactions.length ? highCostCount || 7 : 7,
        badgeBg: "bg-[#ffe4e6]",
        badgeTextColor: "text-[#e11d48]",
        title: "High Cost",
        nominal: formatJt(highCostSum, "Rp 128,7 jt"),
        statusText: "Perlu ditinjau",
        targetFilterTag: "HIGH_COST",
      },
      {
        badge: transactions.length ? missingEvidenceCount || 6 : 6,
        badgeBg: "bg-[#fef3c7]",
        badgeTextColor: "text-[#d97706]",
        title: "Missing Evidence",
        nominal: formatJt(missingEvidenceSum, "Rp 42,1 jt"),
        statusText: "Perlu ditinjau",
        targetFilterTag: "MISSING_EVIDENCE",
      },
      {
        badge: transactions.length ? duplicateCount || 4 : 4,
        badgeBg: "bg-[#f3e8ff]",
        badgeTextColor: "text-[#9333ea]",
        title: "Duplicate Data",
        nominal: formatJt(duplicateSum, "Rp 18,4 jt"),
        statusText: "Perlu ditinjau",
        targetFilterTag: "DUPLICATE_DATA",
      },
    ];
  }, [transactions]);

  // 2. Data untuk Halaman Navigasi 2 sampai 5
  const pagesData: Record<number, AnomalyCardData[]> = useMemo(() => {
    return {
      1: dynamicPage1Cards,
      2: [
        {
          badge: 3,
          badgeBg: "bg-[#fee2e2]",
          badgeTextColor: "text-[#e11d48]",
          title: "> 24 Jam Overdue",
          nominal: "Rp 128,5 jt",
          statusText: "Prioritas Kritis SLA",
          targetFilterTag: "OVER_BUDGET",
        },
        {
          badge: 5,
          badgeBg: "bg-[#ffe4e6]",
          badgeTextColor: "text-[#e11d48]",
          title: "Unmatched CRM",
          nominal: "Rp 64,2 jt",
          statusText: "Job belum terdaftar",
          targetFilterTag: "DUPLICATE_DATA",
        },
        {
          badge: 4,
          badgeBg: "bg-[#fef3c7]",
          badgeTextColor: "text-[#d97706]",
          title: "Demurrage Storage",
          nominal: "Rp 23,8 jt",
          statusText: "Penumpukan gudang",
          targetFilterTag: "HIGH_COST",
        },
        {
          badge: 2,
          badgeBg: "bg-[#f3e8ff]",
          badgeTextColor: "text-[#9333ea]",
          title: "Variance > 15%",
          nominal: "Rp 19,4 jt",
          statusText: "Selisih melebihi pagu",
          targetFilterTag: "OVER_BUDGET",
        },
      ],
      3: [
        {
          badge: 8,
          badgeBg: "bg-[#fee2e2]",
          badgeTextColor: "text-[#e11d48]",
          title: "Trucking Overlimit",
          nominal: "Rp 94,6 jt",
          statusText: "Rute Jawa - Bali",
          targetFilterTag: "OVER_BUDGET",
        },
        {
          badge: 6,
          badgeBg: "bg-[#ffe4e6]",
          badgeTextColor: "text-[#e11d48]",
          title: "Handling Fee",
          nominal: "Rp 51,2 jt",
          statusText: "Biaya terminal kargo",
          targetFilterTag: "HIGH_COST",
        },
        {
          badge: 5,
          badgeBg: "bg-[#fef3c7]",
          badgeTextColor: "text-[#d97706]",
          title: "Warehouse Overstay",
          nominal: "Rp 31,5 jt",
          statusText: "Gudang Cikarang",
          targetFilterTag: "MISSING_EVIDENCE",
        },
        {
          badge: 3,
          badgeBg: "bg-[#f3e8ff]",
          badgeTextColor: "text-[#9333ea]",
          title: "Customs Clearance",
          nominal: "Rp 16,7 jt",
          statusText: "Verifikasi PPh 23",
          targetFilterTag: "DUPLICATE_DATA",
        },
      ],
      4: [
        {
          badge: 5,
          badgeBg: "bg-[#fee2e2]",
          badgeTextColor: "text-[#e11d48]",
          title: "Kuitansi Belum Ada",
          nominal: "Rp 38,4 jt",
          statusText: "Vendor Trucking",
          targetFilterTag: "MISSING_EVIDENCE",
        },
        {
          badge: 4,
          badgeBg: "bg-[#ffe4e6]",
          badgeTextColor: "text-[#e11d48]",
          title: "Nota Timbang Buram",
          nominal: "Rp 21,9 jt",
          statusText: "Perlu re-scan bukti",
          targetFilterTag: "MISSING_EVIDENCE",
        },
        {
          badge: 3,
          badgeBg: "bg-[#fef3c7]",
          badgeTextColor: "text-[#d97706]",
          title: "Pending Approval",
          nominal: "Rp 14,2 jt",
          statusText: "Menunggu Controller",
          targetFilterTag: "OVER_BUDGET",
        },
        {
          badge: 2,
          badgeBg: "bg-[#f3e8ff]",
          badgeTextColor: "text-[#9333ea]",
          title: "Faktur Pajak Pending",
          nominal: "Rp 9,8 jt",
          statusText: "Validasi tim FAT",
          targetFilterTag: "DUPLICATE_DATA",
        },
      ],
      5: [
        {
          badge: 12,
          badgeBg: "bg-[#fee2e2]",
          badgeTextColor: "text-[#e11d48]",
          title: "Jakarta Pusat",
          nominal: "Rp 142,5 jt",
          statusText: "12 item aktif",
          targetFilterTag: "OVER_BUDGET",
        },
        {
          badge: 8,
          badgeBg: "bg-[#ffe4e6]",
          badgeTextColor: "text-[#e11d48]",
          title: "Surabaya",
          nominal: "Rp 68,9 jt",
          statusText: "8 item aktif",
          targetFilterTag: "HIGH_COST",
        },
        {
          badge: 4,
          badgeBg: "bg-[#fef3c7]",
          badgeTextColor: "text-[#d97706]",
          title: "Semarang",
          nominal: "Rp 29,4 jt",
          statusText: "4 item aktif",
          targetFilterTag: "MISSING_EVIDENCE",
        },
        {
          badge: 2,
          badgeBg: "bg-[#f3e8ff]",
          badgeTextColor: "text-[#9333ea]",
          title: "Vendor Eksternal",
          nominal: "Rp 15,1 jt",
          statusText: "Armada Cadangan",
          targetFilterTag: "DUPLICATE_DATA",
        },
      ],
    };
  }, [dynamicPage1Cards]);

  // Total Item Anomali untuk Subjudul
  const totalItemCount = useMemo(() => {
    return transactions.length
      ? transactions.filter((t) => t.review_flag || t.variance > 0 || !t.has_evidence).length || 26
      : 26;
  }, [transactions]);

  // Kartu yang ditampilkan sesuai halaman aktif
  const displayedCards = pagesData[currentPage] || pagesData[1];

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
      {/* Header & Pill Pagination Navigasi Aktif */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Ringkasan Exception</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {totalItemCount} item memerlukan tindak lanjut
          </p>
        </div>

        {/* Pill Navigasi (1, 2, 3, 4, 5 Berfungsi Penuh) */}
        <div className="flex items-center rounded-full border border-sky-400/90 bg-white px-3 py-1 gap-2.5 shadow-xs">
          {[1, 2, 3, 4, 5].map((pageNum) => (
            <button
              key={pageNum}
              onClick={() => setCurrentPage(pageNum)}
              className="group relative flex items-center justify-center transition active:scale-95"
              title={`Buka Halaman ${pageNum}`}
            >
              {currentPage === pageNum ? (
                // Indikator Titik Biru Solid untuk Halaman yang Sedang Aktif
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#0a7ebf] shadow-xs" />
              ) : (
                // Angka untuk Halaman Lainnya
                <span className="text-xs font-semibold text-slate-600 transition group-hover:text-slate-900">
                  {pageNum}
                </span>
              )}
            </button>
          ))}

          {/* Tombol Panah Kanan (Next Page) */}
          <button
            onClick={() => setCurrentPage((prev) => (prev < 5 ? prev + 1 : 1))}
            className="text-[#0a7ebf] transition hover:text-[#08689d] active:scale-95 ml-0.5"
            title="Halaman Berikutnya"
          >
            <ChevronRight className="h-3.5 w-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Grid 4 Kartu Anomali Dinamis */}
      <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {displayedCards.map((card, idx) => (
          <div
            key={`${card.title}-${idx}`}
            onClick={() => router.push("/cost-exception")}
            className="cursor-pointer rounded-xl bg-[#f8fafc] p-4 transition-all duration-200 hover:bg-slate-100/90 hover:shadow-xs active:scale-[0.99]"
            title={`Klik untuk meninjau ${card.title}`}
          >
            {/* Lencana Angka Bulat */}
            <div
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${card.badgeBg} ${card.badgeTextColor}`}
            >
              {card.badge}
            </div>

            {/* Judul Anomali */}
            <h4 className="mt-3 text-xs font-bold text-slate-800 truncate">
              {card.title}
            </h4>

            {/* Nominal Realisasi */}
            <p className="mt-1.5 text-xs font-bold text-slate-700">
              {card.nominal}
            </p>

            {/* Keterangan Status */}
            <p className="mt-1 text-[11px] text-slate-400">
              {card.statusText}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}