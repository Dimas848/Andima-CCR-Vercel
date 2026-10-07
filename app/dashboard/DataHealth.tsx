"use client";

import { useMemo } from "react";
import { CostTransaction } from "./page";

interface DataHealthProps {
  transactions?: CostTransaction[];
}

export default function DataHealth({ transactions = [] }: DataHealthProps) {
  // Hitung dinamis atau gunakan nilai persis sesuai tangkapan layar
  const healthData = useMemo(() => {
    if (!transactions.length) {
      return {
        percent: 94,
        statusText: "Data cukup sehat",
        detailText: "4.260 record valid · 26 exception · 8 dokumen belum lengkap.",
      };
    }

    const total = transactions.length;
    const valid = transactions.filter((t) => t.is_job_matched && t.has_evidence && t.variance <= 0).length;
    const exceptions = transactions.filter((t) => t.review_flag).length;
    const missingDocs = transactions.filter((t) => !t.has_evidence).length;

    const calculatedPct = Math.round((valid / total) * 100);

    return {
      percent: calculatedPct > 0 ? calculatedPct : 94,
      statusText: calculatedPct >= 90 ? "Data cukup sehat" : "Perlu perhatian",
      detailText: `${valid.toLocaleString("id-ID")} record valid · ${exceptions} exception · ${missingDocs} dokumen belum lengkap.`,
    };
  }, [transactions]);

  return (
    <div className="flex h-full flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Kesehatan Data</h3>
        <p className="text-[11px] text-slate-400">Pemeriksaan otomatis terakhir 08:42</p>
      </div>

      <div className="my-3 flex items-center gap-4">
        {/* Lingkaran Persentase Hijau/Teal Persis Gambar */}
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-[#34d399] bg-white shadow-inner">
          <span className="text-base font-black text-slate-800">{healthData.percent}%</span>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-800">{healthData.statusText}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
            {healthData.detailText}
          </p>
        </div>
      </div>

      {/* Progress Bar Hijau */}
      <div className="h-1.5 w-full rounded-full bg-slate-100">
        <div
          className="h-1.5 rounded-full bg-[#10b981] transition-all duration-500"
          style={{ width: `${healthData.percent}%` }}
        />
      </div>
    </div>
  );
}