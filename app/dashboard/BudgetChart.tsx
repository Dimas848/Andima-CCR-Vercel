"use client";

import { useMemo } from "react";
import StatusBadge from "./StatusBadge";
import { CostTransaction } from "./page";

interface BudgetChartProps {
  transactions?: CostTransaction[];
}

export default function BudgetChart({ transactions = [] }: BudgetChartProps) {
  // Data default 6 bulan terakhir persis seperti tangkapan layar
  const defaultData = [
    { month: "Apr", budget: 150, actual: 143 },
    { month: "Mei", budget: 165, actual: 157 },
    { month: "Jun", budget: 172, actual: 169 },
    { month: "Jul", budget: 181, actual: 176 },
    { month: "Agu", budget: 189, actual: 196 },
    { month: "Sep", budget: 172, actual: 184 },
  ];

  // Hitung dinamis dari transaksi jika ada, jika belum gunakan default gambar
  const chartData = useMemo(() => {
    if (!transactions.length) return defaultData;

    // Ambil nilai bulan September dari live transactions
    const totalActual = transactions.reduce((acc, t) => acc + (t.actual_cost || 0), 0);
    const totalBudget = transactions.reduce((acc, t) => acc + (t.planned_cost || 0), 0);

    const actualJt = Math.round(totalActual / 1_000_000);
    const budgetJt = Math.round(totalBudget / 1_000_000);

    return [
      { month: "Apr", budget: 150, actual: 143 },
      { month: "Mei", budget: 165, actual: 157 },
      { month: "Jun", budget: 172, actual: 169 },
      { month: "Jul", budget: 181, actual: 176 },
      { month: "Agu", budget: 189, actual: 196 },
      { month: "Sep", budget: budgetJt > 0 ? budgetJt : 172, actual: actualJt > 0 ? actualJt : 184 },
    ];
  }, [transactions]);

  const max = Math.max(...chartData.map((d) => Math.max(d.budget, d.actual)));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Budget vs Actual</h3>
          <p className="text-[11px] text-slate-400">Nilai dalam juta rupiah · 6 bulan terakhir</p>
        </div>
        <StatusBadge value="Aktual +7,1%" tone="danger" />
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
              style={{ height: `${(d.budget / max) * 100}%` }}
              title={`Budget: ${d.budget} jt`}
            />
            <div
              className="w-3.5 rounded-t bg-[#d4194f] transition-all duration-300"
              style={{ height: `${(d.actual / max) * 100}%` }}
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