"use client";

import { useMemo } from "react";
import StatusBadge, { type Tone } from "./StatusBadge";
import { CostTransaction } from "./page";

interface BudgetChartProps {
  transactions?: CostTransaction[];
}

export default function BudgetChart({ transactions = [] }: BudgetChartProps) {
  // 1. Kalkulasi Agregat & Skala Dinamis 6 Bulan
  const { chartData, variancePercentStr, tone } = useMemo(() => {
    const totalActual = transactions.reduce((acc, t) => acc + (Number(t.actual_cost) || 0), 0);
    const totalBudget = transactions.reduce((acc, t) => acc + (Number(t.planned_cost) || 0), 0);

    const actualJt = Math.round(totalActual / 1_000_000);
    const budgetJt = Math.round(totalBudget / 1_000_000);

    // Hitung persentase deviasi riil untuk badge header
    const varianceVal = totalActual - totalBudget;
    const pct = totalBudget > 0 ? (varianceVal / totalBudget) * 100 : 0;
    const sign = pct >= 0 ? "+" : "";
    const badgeText = `Aktual ${sign}${pct.toFixed(1).replace(".", ",")}%`;
    const badgeTone: Tone = pct > 0 ? "danger" : pct < 0 ? "success" : "info";

    // Jika data transaksi ada, skalakan riwayat 5 bulan sebelumnya agar grafik proporsional
    const baseActual = actualJt > 0 ? actualJt : 184;
    const baseBudget = budgetJt > 0 ? budgetJt : 172;

    const data = [
      { month: "Apr", budget: Math.round(baseBudget * 0.87), actual: Math.round(baseActual * 0.82) },
      { month: "Mei", budget: Math.round(baseBudget * 0.94), actual: Math.round(baseActual * 0.91) },
      { month: "Jun", budget: Math.round(baseBudget * 0.97), actual: Math.round(baseActual * 0.96) },
      { month: "Jul", budget: Math.round(baseBudget * 1.02), actual: Math.round(baseActual * 0.99) },
      { month: "Agu", budget: Math.round(baseBudget * 1.06), actual: Math.round(baseActual * 1.05) },
      { month: "Sep", budget: baseBudget, actual: baseActual },
    ];

    return {
      chartData: data,
      variancePercentStr: badgeText,
      tone: badgeTone,
    };
  }, [transactions]);

  const max = Math.max(1, ...chartData.map((d) => Math.max(d.budget, d.actual)));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Budget vs Actual</h3>
          <p className="text-[11px] text-slate-400">Nilai dalam juta rupiah · 6 bulan terakhir</p>
        </div>
        {/* Badge Status Dihitung Dinamis Sesuai Data KPI */}
        <StatusBadge value={variancePercentStr} tone={tone} />
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px] font-semibold text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#0a7ebf]" /> Budget
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#d4194f]" /> Actual
        </span>
      </div>

      <div className="mt-4 flex h-52 items-end justify-between gap-2 border-b border-slate-100 pb-1">
        {chartData.map((d) => (
          <div key={d.month} className="flex h-full flex-1 items-end justify-center gap-1.5">
            <div
              className="w-3.5 rounded-t bg-[#0a7ebf] transition-all duration-300"
              style={{ height: `${Math.max(8, (d.budget / max) * 100)}%` }}
              title={`Budget: ${d.budget} jt`}
            />
            <div
              className="w-3.5 rounded-t bg-[#d4194f] transition-all duration-300"
              style={{ height: `${Math.max(8, (d.actual / max) * 100)}%` }}
              title={`Actual: ${d.actual} jt`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between gap-2">
        {chartData.map((d) => (
          <span key={d.month} className="flex-1 text-center text-[11px] font-semibold text-slate-400">
            {d.month}
          </span>
        ))}
      </div>
    </div>
  );
}