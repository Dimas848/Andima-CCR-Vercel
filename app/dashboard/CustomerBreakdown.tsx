"use client";

import { useMemo } from "react";
import StatusBadge, { type Tone } from "./StatusBadge";
import { CostTransaction, cleanCustomerName } from "./page";

interface Customer {
  name: string;
  value: string;
  delta: string;
  tone: Tone;
  width: string;
  barClass: string;
}

interface CustomerBreakdownProps {
  transactions?: CostTransaction[];
}

export default function CustomerBreakdown({ transactions = [] }: CustomerBreakdownProps) {
  // Hitung dinamis kontribusi 4 customer utama dari transaksi terfilter
  const customers = useMemo((): Customer[] => {
    if (!transactions.length) return [];

    const map = new Map<string, { displayName: string; actual: number; planned: number }>();
    transactions.forEach((t, idx) => {
      const rawName = cleanCustomerName(t.customer_name, idx);
      const key = rawName.toUpperCase();
      const current = map.get(key) || { displayName: rawName, actual: 0, planned: 0 };
      map.set(key, {
        displayName: current.displayName,
        actual: current.actual + (Number(t.actual_cost) || 0),
        planned: current.planned + (Number(t.planned_cost) || 0),
      });
    });

    // Ambil 4 customer dengan nilai realisasi terbesar
    const sortedTop4 = Array.from(map.values())
      .sort((a, b) => b.actual - a.actual)
      .slice(0, 4);

    // Hitung total dari customer yang ditampilkan agar total persentasenya tepat 100,0%
    const top4TotalActual = sortedTop4.reduce((acc, item) => acc + item.actual, 0);
    const maxVal = sortedTop4[0]?.actual || 1;

    const rawPcts = sortedTop4.map((val) =>
      top4TotalActual > 0 ? Number(((val.actual / top4TotalActual) * 100).toFixed(1)) : 0
    );
    if (rawPcts.length > 0 && top4TotalActual > 0) {
      const sumOthers = rawPcts.slice(0, -1).reduce((a, b) => a + b, 0);
      rawPcts[rawPcts.length - 1] = Number(Math.max(0, 100 - sumOthers).toFixed(1));
    }

    return sortedTop4.map((val, idx) => {
      const sharePct = rawPcts[idx] ?? 0;
      const variance = val.actual - val.planned;
      const isOverBudget = variance > 0;

      const badgeText = `${sharePct.toFixed(1).replace(".", ",")}%`;
      const tone: Tone = isOverBudget ? "danger" : "info";

      let formattedValue = `Rp ${val.actual.toLocaleString("id-ID")}`;
      if (Math.abs(val.actual) >= 1_000_000_000) {
        formattedValue = `Rp ${(val.actual / 1_000_000_000).toLocaleString("id-ID", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 2,
        })} M`;
      } else if (Math.abs(val.actual) >= 1_000_000) {
        formattedValue = `Rp ${(val.actual / 1_000_000).toLocaleString("id-ID", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })} jt`;
      }

      return {
        name: val.displayName,
        value: formattedValue,
        delta: badgeText,
        tone,
        barClass: isOverBudget ? "bg-[#d4194f]" : "bg-[#0a7ebf]",
        width: `${Math.max(15, Math.round((val.actual / maxVal) * 100))}%`,
      };
    });
  }, [transactions]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">Breakdown Cost per Customer</h3>
      <p className="text-[11px] text-slate-400">Kontribusi terhadap total cost</p>

      {customers.length === 0 ? (
        <div className="mt-5 flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
          <p className="text-xs text-slate-400">
            Tidak ada data transaksi untuk kombinasi filter Customer dan Cabang Operasional ini.
          </p>
        </div>
      ) : (
        <div className="mt-5 flex flex-1 flex-col justify-between gap-4">
          {customers.map((c) => (
            <div key={c.name}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-slate-700 truncate max-w-[200px]" title={c.name}>
                  {c.name}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-slate-900">{c.value}</span>
                  <StatusBadge value={c.delta} tone={c.tone} />
                </div>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                <div className={`h-1.5 rounded-full ${c.barClass}`} style={{ width: c.width }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}