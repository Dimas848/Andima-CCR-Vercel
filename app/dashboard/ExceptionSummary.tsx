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

  const formatJt = (val: number): string => {
    if (val === 0) return "Rp 0";
    return `Rp ${(val / 1_000_000).toLocaleString("id-ID", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} jt`;
  };

  // 1. HALAMAN 1: 4 Kategori Anomali Pokok
  const dynamicPage1Cards = useMemo((): AnomalyCardData[] => {
    let overBudgetCount = 0;
    let overBudgetSum = 0;
    let highCostCount = 0;
    let highCostSum = 0;
    let missingEvidenceCount = 0;
    let missingEvidenceSum = 0;
    let unmatchedCount = 0;
    let unmatchedSum = 0;

    transactions.forEach((t) => {
      const actual = Number(t.actual_cost || 0);
      const planned = Number(t.planned_cost || 0);
      const variance = Number(t.variance || (actual - planned));

      if (!t.is_job_matched || t.job_number === "UNMATCHED" || t.job_number === "-" || !t.job_number) {
        unmatchedCount++;
        unmatchedSum += actual;
      } else if (!t.has_evidence || t.exception_tags?.includes("MISSING_EVIDENCE")) {
        missingEvidenceCount++;
        missingEvidenceSum += actual;
      } else if (variance > 0 || t.exception_tags?.includes("OVER_BUDGET")) {
        overBudgetCount++;
        overBudgetSum += actual;
      } else if (actual >= 50_000_000 || t.exception_tags?.includes("HIGH_COST")) {
        highCostCount++;
        highCostSum += actual;
      }
    });

    return [
      {
        badge: overBudgetCount,
        badgeBg: "bg-[#fee2e2]",
        badgeTextColor: "text-[#e11d48]",
        title: "Over Budget",
        nominal: formatJt(overBudgetSum),
        statusText: overBudgetCount > 0 ? "Perlu ditinjau" : "Sesuai pagu",
        targetFilterTag: "Over Budget",
      },
      {
        badge: highCostCount,
        badgeBg: "bg-[#ffe4e6]",
        badgeTextColor: "text-[#e11d48]",
        title: "High Cost",
        nominal: formatJt(highCostSum),
        statusText: highCostCount > 0 ? "Perlu ditinjau" : "Normal",
        targetFilterTag: "High Cost",
      },
      {
        badge: missingEvidenceCount,
        badgeBg: "bg-[#fef3c7]",
        badgeTextColor: "text-[#d97706]",
        title: "Missing Evidence",
        nominal: formatJt(missingEvidenceSum),
        statusText: missingEvidenceCount > 0 ? "Perlu ditinjau" : "Lengkap",
        targetFilterTag: "Missing Evidence",
      },
      {
        badge: unmatchedCount,
        badgeBg: "bg-[#f3e8ff]",
        badgeTextColor: "text-[#9333ea]",
        title: "Unmatched CRM",
        nominal: formatJt(unmatchedSum),
        statusText: unmatchedCount > 0 ? "Perlu ditinjau" : "Job terdaftar",
        targetFilterTag: "Duplicate Data",
      },
    ];
  }, [transactions]);

  // 2. HALAMAN 2 S.D. 5: Murni Dihitung dari Data Transaksi Riil
  const pagesData: Record<number, AnomalyCardData[]> = useMemo(() => {
    const now = Date.now();

    // Halaman 2: Dimensi SLA & Risiko Finansial
    let slaOverdueCount = 0;
    let slaOverdueSum = 0;
    let highVarianceCount = 0;
    let highVarianceSum = 0;

    transactions.forEach((t) => {
      const actual = Number(t.actual_cost || 0);
      const planned = Number(t.planned_cost || 0);
      const variance = Number(t.variance || (actual - planned));
      const createdTime = new Date(t.created_at || now).getTime();
      const isOver24h = (now - createdTime) > 24 * 60 * 60 * 1000;

      if (isOver24h && (t.review_flag || variance > 0 || !t.has_evidence || !t.is_job_matched)) {
        slaOverdueCount++;
        slaOverdueSum += actual;
      }
      if (planned > 0 && (variance / planned) > 0.05) {
        highVarianceCount++;
        highVarianceSum += actual;
      }
    });

    const page2: AnomalyCardData[] = [
      {
        badge: slaOverdueCount,
        badgeBg: "bg-[#fee2e2]",
        badgeTextColor: "text-[#e11d48]",
        title: "> 24 Jam Overdue",
        nominal: formatJt(slaOverdueSum),
        statusText: slaOverdueCount > 0 ? "Prioritas Kritis SLA" : "SLA Aman",
        targetFilterTag: "Critical",
      },
      dynamicPage1Cards[3], // Unmatched CRM
      dynamicPage1Cards[2], // Missing Evidence
      {
        badge: highVarianceCount,
        badgeBg: "bg-[#f3e8ff]",
        badgeTextColor: "text-[#9333ea]",
        title: "Variance > 5%",
        nominal: formatJt(highVarianceSum),
        statusText: highVarianceCount > 0 ? "Deviasi anggaran" : "Terkendali",
        targetFilterTag: "Over Budget",
      },
    ];

    // Halaman 3: Dimensi Kategori Biaya Operasional
    const catMap: Record<string, { c: number; s: number }> = {
      TRUCKING: { c: 0, s: 0 },
      HANDLING: { c: 0, s: 0 },
      STORAGE: { c: 0, s: 0 },
      OPERATIONAL: { c: 0, s: 0 },
    };

    transactions.forEach((t) => {
      const cat = (t.cost_category || "OPERATIONAL").toUpperCase();
      const actual = Number(t.actual_cost || 0);
      const isAnomaly = t.review_flag || t.variance > 0 || !t.has_evidence || !t.is_job_matched;

      if (isAnomaly) {
        if (cat.includes("TRUCK")) { catMap.TRUCKING.c++; catMap.TRUCKING.s += actual; }
        else if (cat.includes("HANDL")) { catMap.HANDLING.c++; catMap.HANDLING.s += actual; }
        else if (cat.includes("STOR")) { catMap.STORAGE.c++; catMap.STORAGE.s += actual; }
        else { catMap.OPERATIONAL.c++; catMap.OPERATIONAL.s += actual; }
      }
    });

    const page3: AnomalyCardData[] = [
      {
        badge: catMap.TRUCKING.c,
        badgeBg: "bg-[#fee2e2]",
        badgeTextColor: "text-[#e11d48]",
        title: "Trucking Overlimit",
        nominal: formatJt(catMap.TRUCKING.s),
        statusText: "Rute Armada",
        targetFilterTag: "Over Budget",
      },
      {
        badge: catMap.HANDLING.c,
        badgeBg: "bg-[#ffe4e6]",
        badgeTextColor: "text-[#e11d48]",
        title: "Handling Fee",
        nominal: formatJt(catMap.HANDLING.s),
        statusText: "Biaya Terminal",
        targetFilterTag: "High Cost",
      },
      {
        badge: catMap.STORAGE.c,
        badgeBg: "bg-[#fef3c7]",
        badgeTextColor: "text-[#d97706]",
        title: "Demurrage Storage",
        nominal: formatJt(catMap.STORAGE.s),
        statusText: "Penumpukan Gudang",
        targetFilterTag: "Missing Evidence",
      },
      {
        badge: catMap.OPERATIONAL.c,
        badgeBg: "bg-[#f3e8ff]",
        badgeTextColor: "text-[#9333ea]",
        title: "Other Ops",
        nominal: formatJt(catMap.OPERATIONAL.s),
        statusText: "Biaya Operasional",
        targetFilterTag: "Duplicate Data",
      },
    ];

    // Halaman 4: Dimensi Kelengkapan Bukti & Kesiapan Audit
    let verifiedCount = 0;
    let verifiedSum = 0;
    let unverifiedCount = 0;
    let unverifiedSum = 0;

    transactions.forEach((t) => {
      const actual = Number(t.actual_cost || 0);
      if (t.has_evidence) {
        verifiedCount++;
        verifiedSum += actual;
      } else {
        unverifiedCount++;
        unverifiedSum += actual;
      }
    });

    const page4: AnomalyCardData[] = [
      {
        badge: unverifiedCount,
        badgeBg: "bg-[#fee2e2]",
        badgeTextColor: "text-[#e11d48]",
        title: "Kuitansi Belum Ada",
        nominal: formatJt(unverifiedSum),
        statusText: "Wajib kuitansi fisik",
        targetFilterTag: "Missing Evidence",
      },
      {
        badge: dynamicPage1Cards[0].badge,
        badgeBg: "bg-[#ffe4e6]",
        badgeTextColor: "text-[#e11d48]",
        title: "Pending Approval",
        nominal: dynamicPage1Cards[0].nominal,
        statusText: "Menunggu Controller",
        targetFilterTag: "Over Budget",
      },
      {
        badge: verifiedCount,
        badgeBg: "bg-[#ecfdf5]",
        badgeTextColor: "text-[#059669]",
        title: "Bukti Terlampir",
        nominal: formatJt(verifiedSum),
        statusText: "Telah divalidasi",
        targetFilterTag: "Semua Tipe",
      },
      {
        badge: dynamicPage1Cards[3].badge,
        badgeBg: "bg-[#f3e8ff]",
        badgeTextColor: "text-[#9333ea]",
        title: "Validasi CRM",
        nominal: dynamicPage1Cards[3].nominal,
        statusText: "Pencocokan Job",
        targetFilterTag: "Duplicate Data",
      },
    ];

    // Halaman 5: Dimensi Cabang Operasional (FR-001)
    const branchMap: Record<string, { c: number; s: number }> = {
      JKT: { c: 0, s: 0 },
      SBY: { c: 0, s: 0 },
      SMG: { c: 0, s: 0 },
      NAS: { c: 0, s: 0 },
    };

    transactions.forEach((t) => {
      const b = (t.branch_code || "").toLowerCase();
      const actual = Number(t.actual_cost || 0);
      const isAnomaly = t.review_flag || t.variance > 0 || !t.has_evidence || !t.is_job_matched;

      if (isAnomaly) {
        if (b.includes("jakarta")) { branchMap.JKT.c++; branchMap.JKT.s += actual; }
        else if (b.includes("surabaya")) { branchMap.SBY.c++; branchMap.SBY.s += actual; }
        else if (b.includes("semarang")) { branchMap.SMG.c++; branchMap.SMG.s += actual; }
        else { branchMap.NAS.c++; branchMap.NAS.s += actual; }
      }
    });

    const page5: AnomalyCardData[] = [
      {
        badge: branchMap.JKT.c,
        badgeBg: "bg-[#fee2e2]",
        badgeTextColor: "text-[#e11d48]",
        title: "Jakarta Pusat",
        nominal: formatJt(branchMap.JKT.s),
        statusText: `${branchMap.JKT.c} item aktif`,
        targetFilterTag: "Over Budget",
      },
      {
        badge: branchMap.SBY.c,
        badgeBg: "bg-[#ffe4e6]",
        badgeTextColor: "text-[#e11d48]",
        title: "Surabaya",
        nominal: formatJt(branchMap.SBY.s),
        statusText: `${branchMap.SBY.c} item aktif`,
        targetFilterTag: "High Cost",
      },
      {
        badge: branchMap.SMG.c,
        badgeBg: "bg-[#fef3c7]",
        badgeTextColor: "text-[#d97706]",
        title: "Semarang",
        nominal: formatJt(branchMap.SMG.s),
        statusText: `${branchMap.SMG.c} item aktif`,
        targetFilterTag: "Missing Evidence",
      },
      {
        badge: branchMap.NAS.c,
        badgeBg: "bg-[#f3e8ff]",
        badgeTextColor: "text-[#9333ea]",
        title: "Cabang Lainnya",
        nominal: formatJt(branchMap.NAS.s),
        statusText: `${branchMap.NAS.c} item aktif`,
        targetFilterTag: "Duplicate Data",
      },
    ];

    return {
      1: dynamicPage1Cards,
      2: page2,
      3: page3,
      4: page4,
      5: page5,
    };
  }, [transactions, dynamicPage1Cards]);

  // Total Item Anomali Riil (Sesuai dengan 4 Kondisi Baku)
  const totalItemCount = useMemo(() => {
    return transactions.filter(
      (t) => t.review_flag || t.variance > 0 || !t.has_evidence || !t.is_job_matched
    ).length;
  }, [transactions]);

  const displayedCards = pagesData[currentPage] || pagesData[1];

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Ringkasan Exception</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {totalItemCount} item memerlukan tindak lanjut
          </p>
        </div>

        {/* Pill Navigasi Dinamis */}
        <div className="flex items-center rounded-full border border-sky-400/90 bg-white px-3 py-1 gap-2.5 shadow-xs">
          {[1, 2, 3, 4, 5].map((pageNum) => (
            <button
              key={pageNum}
              onClick={() => setCurrentPage(pageNum)}
              className="group relative flex items-center justify-center transition active:scale-95"
              title={`Buka Halaman ${pageNum}`}
            >
              {currentPage === pageNum ? (
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#0a7ebf] shadow-xs" />
              ) : (
                <span className="text-xs font-semibold text-slate-600 transition group-hover:text-slate-900">
                  {pageNum}
                </span>
              )}
            </button>
          ))}

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
            <div
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${card.badgeBg} ${card.badgeTextColor}`}
            >
              {card.badge}
            </div>
            <h4 className="mt-3 text-xs font-bold text-slate-800 truncate">
              {card.title}
            </h4>
            <p className="mt-1.5 text-xs font-bold text-slate-700">
              {card.nominal}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {card.statusText}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}