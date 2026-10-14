"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  TrendingUp,
  AlertCircle,
  FileText,
  ArrowRight,
} from "lucide-react";
import { CostTransaction } from "./page";
import { supabase } from "@/lib/supabase";

interface NotificationPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  transactions?: CostTransaction[];
  periode?: string;
  onViewAllExceptions?: () => void;
}

export default function NotificationPopover({
  isOpen,
  onClose,
  transactions = [],
  periode = "Oktober 2026",
  onViewAllExceptions,
}: NotificationPopoverProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"semua" | "belum_dibaca">("semua");
  const [isMarkedAllRead, setIsMarkedAllRead] = useState(false);

  const [dbTransactions, setDbTransactions] = useState<CostTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMarkedAllRead(localStorage.getItem("c2_notif_read") === "true");
    }
  }, [isOpen]);

  const handleToggleRead = () => {
    setIsMarkedAllRead((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("c2_notif_read", String(next));
      }
      return next;
    });
  };

  const handleCardClick = (tag: string) => {
    onClose();
    if (typeof window !== "undefined") {
      sessionStorage.setItem("c2_filter_tag", tag);
    }
    router.push(`/cost-exception?tag=${encodeURIComponent(tag)}`);
  };

  useEffect(() => {
    if (transactions && transactions.length > 0) {
      setDbTransactions(transactions);
    } else if (isOpen) {
      const fetchTransactionsFromDb = async () => {
        setIsLoading(true);
        try {
          const { data, error } = await supabase
            .from("c2_cost_transactions")
            .select("*")
            .order("created_at", { ascending: false });

          if (!error && data) {
            setDbTransactions(data as any);
          }
        } catch (err) {
          console.error("Gagal mengambil data notifikasi:", err);
        } finally {
          setIsLoading(false);
        }
      };
      fetchTransactionsFromDb();
    }
  }, [transactions, isOpen]);

  const notifData = useMemo(() => {
    const activeList = (dbTransactions.length > 0 ? dbTransactions : transactions).filter(
      (t: any) => t.status !== "Selesai"
    );

    if (!activeList || activeList.length === 0) {
      return {
        totalExceptions: 0,
        overBudgetCount: 0,
        overBudgetValue: "Rp 0",
        highCostCount: 0,
        highCostValue: "Rp 0",
        missingEvidenceCount: 0,
        missingEvidenceValue: "Rp 0",
      };
    }

    let overBudget = 0;
    let overBudgetSum = 0;
    let highCost = 0;
    let highCostSum = 0;
    let missingEvidence = 0;
    let missingEvidenceSum = 0;

    activeList.forEach((t: any) => {
      const actual = Number(t.actual_cost || 0);
      const variance = Number(t.variance || 0);

      if (variance > 0 || t.exception_tags?.includes("OVER_BUDGET")) {
        overBudget++;
        overBudgetSum += actual;
      }
      if (actual >= 50_000_000 || t.exception_tags?.includes("HIGH_COST")) {
        highCost++;
        highCostSum += actual;
      }
      if (!t.has_evidence || t.exception_tags?.includes("MISSING_EVIDENCE")) {
        missingEvidence++;
        missingEvidenceSum += actual;
      }
    });

    const formatJt = (val: number) => {
      if (val === 0) return "Rp 0";
      if (Math.abs(val) >= 1_000_000_000) {
        return `Rp ${(val / 1_000_000_000).toLocaleString("id-ID", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 2,
        })} M`;
      }
      return `Rp ${(val / 1_000_000).toLocaleString("id-ID", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })} jt`;
    };

    const totalExceptions = activeList.filter(
      (t: any) =>
        t.review_flag ||
        Number(t.variance || 0) > 0 ||
        !t.has_evidence ||
        t.job_number === "UNMATCHED" ||
        Number(t.actual_cost || 0) >= 50_000_000
    ).length;

    return {
      totalExceptions,
      overBudgetCount: overBudget,
      overBudgetValue: formatJt(overBudgetSum),
      highCostCount: highCost,
      highCostValue: formatJt(highCostSum),
      missingEvidenceCount: missingEvidence,
      missingEvidenceValue: formatJt(missingEvidenceSum),
    };
  }, [dbTransactions, transactions]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/5" onClick={onClose} />

      <div className="absolute right-8 top-16 z-50 w-[380px] rounded-2xl border border-slate-200/90 bg-white shadow-2xl transition-all duration-200 animate-in fade-in slide-in-from-top-2 text-left">
        <div className="p-5 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Notifikasi</h2>
              {!isMarkedAllRead && notifData.totalExceptions > 0 && (
                <span className="h-2 w-2 rounded-full bg-[#0a7ebf]" />
              )}
            </div>

            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-2 text-xs font-bold text-slate-800">
            {isMarkedAllRead ? 0 : notifData.totalExceptions} exception perlu tindak lanjut
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Ringkasan exception · {periode}
          </p>

          <button
            onClick={handleToggleRead}
            className="mt-3 text-xs font-semibold text-[#0a7ebf] transition hover:underline cursor-pointer"
          >
            {isMarkedAllRead ? "Tandai belum dibaca" : "Tandai semua dibaca"}
          </button>

          <div className="mt-3 flex items-center gap-5 border-b border-slate-100">
            <button
              onClick={() => setActiveTab("semua")}
              className={`pb-2 text-xs font-bold transition cursor-pointer ${
                activeTab === "semua"
                  ? "border-b-2 border-[#0a7ebf] text-[#0a7ebf]"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setActiveTab("belum_dibaca")}
              className={`pb-2 text-xs font-medium transition cursor-pointer ${
                activeTab === "belum_dibaca"
                  ? "border-b-2 border-[#0a7ebf] text-[#0a7ebf] font-bold"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Belum dibaca
            </button>
          </div>
        </div>

        <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
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
          ) : notifData.totalExceptions === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Tidak ada anomali atau exception yang tercatat di database.
            </div>
          ) : (
            <>
              <div
                onClick={() => handleCardClick("Over Budget")}
                className={`flex gap-3.5 p-5 transition hover:bg-slate-50 cursor-pointer ${
                  isMarkedAllRead ? "opacity-60" : ""
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-[#e11d48]">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900">Over Budget</h3>
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                      {notifData.overBudgetCount} item
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {notifData.overBudgetValue}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    Realisasi biaya melebihi budget. Tinjau penyebab selisih dan kesesuaian anggaran.
                  </p>
                  <span className="mt-2 block text-[11px] font-bold text-[#e11d48]">
                    Prioritas review anggaran →
                  </span>
                </div>
              </div>

              <div
                onClick={() => handleCardClick("High Cost")}
                className={`flex gap-3.5 p-5 transition hover:bg-slate-50 cursor-pointer ${
                  isMarkedAllRead ? "opacity-60" : ""
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-[#e11d48]">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900">High Cost</h3>
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                      {notifData.highCostCount} item
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {notifData.highCostValue}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    Biaya tunggal di atas threshold rule. Periksa kewajaran nominal dan detail transaksi.
                  </p>
                  <span className="mt-2 block text-[11px] font-bold text-[#e11d48]">
                    Perlu peninjauan biaya →
                  </span>
                </div>
              </div>

              <div
                onClick={() => handleCardClick("Missing Evidence")}
                className={`flex gap-3.5 p-5 transition hover:bg-slate-50 cursor-pointer ${
                  isMarkedAllRead ? "opacity-60" : ""
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900">Missing Evidence</h3>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      {notifData.missingEvidenceCount} item
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {notifData.missingEvidenceValue}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    Dokumen bukti belum lengkap. Lengkapi kuitansi yang valid untuk verifikasi biaya.
                  </p>
                  <span className="mt-2 block text-[11px] font-bold text-amber-600">
                    Perlu kelengkapan dokumen →
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="rounded-b-2xl bg-[#edf8fd] p-3 text-center border-t border-sky-100/60">
          <button
            onClick={() => {
              onClose();
              if (onViewAllExceptions) {
                onViewAllExceptions();
              } else {
                router.push("/cost-exception");
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0a7ebf] transition hover:text-[#08689d] cursor-pointer"
          >
            <span>Lihat semua exception</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}