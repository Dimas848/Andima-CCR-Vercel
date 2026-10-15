"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import type { CostTransaction } from "./page";

interface ExceptionSummaryProps {
  transactions?: CostTransaction[];
  activeCustomer?: string;
  activeBranch?: string;
  activePeriod?: string;
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

const STORAGE_STATUS_KEY = "c2_exception_status_sync";

export default function ExceptionSummary({
  transactions = [],
  activeCustomer = "ALL",
  activeBranch = "ALL",
  activePeriod = "ALL",
}: ExceptionSummaryProps) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [resolvedMap, setResolvedMap] = useState<Record<string, { status: string; notes?: string }>>({});
  const [ruleVariancePct, setRuleVariancePct] = useState<number>(0);
  const [ruleHighCostLimit, setRuleHighCostLimit] = useState<number>(50_000_000);

  const syncLatestExceptionState = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        const savedResolved = JSON.parse(localStorage.getItem(STORAGE_STATUS_KEY) || "{}");
        setResolvedMap(savedResolved);

        const savedVar = localStorage.getItem("c2_rule_variance");
        if (savedVar !== null && savedVar !== "") setRuleVariancePct(Number(savedVar) || 0);

        const savedHigh = localStorage.getItem("c2_rule_highcost");
        if (savedHigh !== null && savedHigh !== "") setRuleHighCostLimit(Number(savedHigh) || 50_000_000);
      } catch {
        // Abaikan jika JSON kosong
      }
    }
  }, []);

  useEffect(() => {
    syncLatestExceptionState();

    const handleFocusOrStorage = () => {
      syncLatestExceptionState();
    };
    window.addEventListener("focus", handleFocusOrStorage);
    window.addEventListener("storage", handleFocusOrStorage);
    return () => {
      window.removeEventListener("focus", handleFocusOrStorage);
      window.removeEventListener("storage", handleFocusOrStorage);
    };
  }, [syncLatestExceptionState, transactions]);

  const formatJt = (val: number): string => {
    if (val === 0) return "Rp 0";
    if (Math.abs(val) >= 1_000_000_000) {
      return `Rp ${(val / 1_000_000_000).toLocaleString("id-ID", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      })} M`;
    }
    if (Math.abs(val) >= 1_000_000) {
      return `Rp ${(val / 1_000_000).toLocaleString("id-ID", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })} jt`;
    }
    return `Rp ${val.toLocaleString("id-ID")}`;
  };

  // Klasifikasi yang 100% IDENTIK dengan app/cost-exception/page.tsx
  const classifyTransaction = useCallback(
    (t: CostTransaction): "Duplicate Data" | "High Cost" | "Over Budget" | "Missing Evidence" | null => {
      const actual = Number(t.actual_cost || 0);
      const planned = Number(t.planned_cost || 0);
      const variance = Number(
        t.variance !== undefined && t.variance !== null ? t.variance : actual - planned
      );
      const job = String(t.job_number || "").trim();

      const isDuplicateOrUnmatched =
        !t.is_job_matched ||
        job === "" ||
        job === "-" ||
        job === "UNMATCHED" ||
        job === "JOB-UNKNOWN-001";

      const isHighCost = actual >= ruleHighCostLimit;
      const isOverBudget =
        variance > 0 &&
        (ruleVariancePct <= 0 || planned === 0 || variance > (planned * ruleVariancePct) / 100);
      const isMissingEvidence = !t.has_evidence;

      if (isDuplicateOrUnmatched) return "Duplicate Data";
      if (isHighCost) return "High Cost";
      if (isOverBudget) return "Over Budget";
      if (isMissingEvidence) return "Missing Evidence";
      return null;
    },
    [ruleHighCostLimit, ruleVariancePct]
  );

  // Filter hanya transaksi anomali aktif yang belum diubah menjadi "Selesai"
  const activeTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const category = classifyTransaction(t);
      if (!category) return false;
      const status = resolvedMap[t.id]?.status || "Terbuka";
      return status !== "Selesai";
    });
  }, [transactions, classifyTransaction, resolvedMap]);

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

    activeTransactions.forEach((t) => {
      const actual = Number(t.actual_cost || 0);
      const category = classifyTransaction(t);

      if (category === "Duplicate Data") {
        unmatchedCount++;
        unmatchedSum += actual;
      } else if (category === "High Cost") {
        highCostCount++;
        highCostSum += actual;
      } else if (category === "Over Budget") {
        overBudgetCount++;
        overBudgetSum += actual;
      } else if (category === "Missing Evidence") {
        missingEvidenceCount++;
        missingEvidenceSum += actual;
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
  }, [activeTransactions, classifyTransaction]);

  // 2. HALAMAN 2 S.D. 5
  const pagesData: Record<number, AnomalyCardData[]> = useMemo(() => {
    let criticalSlaCount = 0;
    let criticalSlaSum = 0;
    let highVarianceCount = 0;
    let highVarianceSum = 0;

    activeTransactions.forEach((t) => {
      const actual = Number(t.actual_cost || 0);
      const planned = Number(t.planned_cost || 0);
      const variance = Number(t.variance !== undefined && t.variance !== null ? t.variance : actual - planned);
      const cat = classifyTransaction(t);
      const isCritical =
        cat === "Duplicate Data" || cat === "High Cost" || (cat === "Over Budget" && variance > 20_000_000);

      if (isCritical) {
        criticalSlaCount++;
        criticalSlaSum += actual;
      }
      if (variance > 0 && (planned === 0 || variance / planned > 0.05)) {
        highVarianceCount++;
        highVarianceSum += actual;
      }
    });

    const page2: AnomalyCardData[] = [
      {
        badge: criticalSlaCount,
        badgeBg: "bg-[#fee2e2]",
        badgeTextColor: "text-[#e11d48]",
        title: "> 24 Jam Overdue",
        nominal: formatJt(criticalSlaSum),
        statusText: criticalSlaCount > 0 ? "Prioritas Kritis SLA" : "SLA Aman",
        targetFilterTag: "Semua Tipe",
      },
      dynamicPage1Cards[3],
      dynamicPage1Cards[2],
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

    const catMap: Record<string, { c: number; s: number }> = {
      TRUCKING: { c: 0, s: 0 },
      HANDLING: { c: 0, s: 0 },
      STORAGE: { c: 0, s: 0 },
      OPERATIONAL: { c: 0, s: 0 },
    };

    activeTransactions.forEach((t) => {
      const cat = (t.cost_category || "OPERATIONAL").toUpperCase();
      const actual = Number(t.actual_cost || 0);

      if (cat.includes("TRUCK")) {
        catMap.TRUCKING.c++;
        catMap.TRUCKING.s += actual;
      } else if (cat.includes("HANDL")) {
        catMap.HANDLING.c++;
        catMap.HANDLING.s += actual;
      } else if (cat.includes("STOR")) {
        catMap.STORAGE.c++;
        catMap.STORAGE.s += actual;
      } else {
        catMap.OPERATIONAL.c++;
        catMap.OPERATIONAL.s += actual;
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

    let verifiedCount = 0;
    let verifiedSum = 0;
    let unverifiedCount = 0;
    let unverifiedSum = 0;

    transactions.forEach((t) => {
      const actual = Number(t.actual_cost || 0);
      const isActiveAnomaly = activeTransactions.some((act) => act.id === t.id);

      if (t.has_evidence || !isActiveAnomaly) {
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

    const branchMap: Record<string, { c: number; s: number }> = {
      JKT: { c: 0, s: 0 },
      SBY: { c: 0, s: 0 },
      SMG: { c: 0, s: 0 },
      NAS: { c: 0, s: 0 },
    };

    activeTransactions.forEach((t) => {
      const b = (t.branch_code || "").toLowerCase();
      const actual = Number(t.actual_cost || 0);

      if (b.includes("jakarta")) {
        branchMap.JKT.c++;
        branchMap.JKT.s += actual;
      } else if (b.includes("surabaya")) {
        branchMap.SBY.c++;
        branchMap.SBY.s += actual;
      } else if (b.includes("semarang")) {
        branchMap.SMG.c++;
        branchMap.SMG.s += actual;
      } else {
        branchMap.NAS.c++;
        branchMap.NAS.s += actual;
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
  }, [activeTransactions, transactions, dynamicPage1Cards, classifyTransaction]);

  const totalItemCount = activeTransactions.length;
  const displayedCards = pagesData[currentPage] || pagesData[1];

  // PERBAIKAN QA 1: Teruskan filter PT, Cabang/Kota, dan Periode yang aktif di Dashboard ke Cost Exception
  const handleCardClick = (targetFilterTag?: string) => {
    if (typeof window !== "undefined") {
      if (targetFilterTag) {
        sessionStorage.setItem("c2_filter_tag", targetFilterTag);
      }

      const cust = activeCustomer !== "ALL" ? activeCustomer : sessionStorage.getItem("c2_dash_customer") || "ALL";
      const br = activeBranch !== "ALL" ? activeBranch : sessionStorage.getItem("c2_dash_branch") || "ALL";
      const pr = activePeriod !== "ALL" ? activePeriod : sessionStorage.getItem("c2_dash_period") || "ALL";

      if (cust && cust !== "ALL") {
        sessionStorage.setItem("c2_filter_customer", cust);
      } else {
        sessionStorage.removeItem("c2_filter_customer");
      }

      if (br && br !== "ALL") {
        sessionStorage.setItem("c2_filter_branch", br);
      } else {
        sessionStorage.removeItem("c2_filter_branch");
      }

      if (pr && pr !== "ALL") {
        sessionStorage.setItem("c2_filter_period", pr);
      } else {
        sessionStorage.removeItem("c2_filter_period");
      }
    }
    router.push("/cost-exception");
  };

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
              className="group relative flex items-center justify-center transition active:scale-95 cursor-pointer"
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
            className="text-[#0a7ebf] transition hover:text-[#08689d] active:scale-95 ml-0.5 cursor-pointer"
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
            onClick={() => handleCardClick(card.targetFilterTag)}
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