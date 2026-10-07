"use client";

import { useMemo } from "react";
import StatusBadge, { type Tone } from "./StatusBadge";
import { CostTransaction } from "./page";

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
  // Nilai cadangan jika tabel Supabase belum terisi
  const defaultCustomers: Customer[] = [
    { name: "PT Nusantara Retail", value: "Rp 324,8 jt", delta: "41,2%", tone: "info", width: "100%", barClass: "bg-[#0a7ebf]" },
    { name: "PT Sinar Logistik", value: "Rp 271,5 jt", delta: "26,5%", tone: "info", width: "83%", barClass: "bg-[#0a7ebf]" },
    { name: "CV Maju Bersama", value: "Rp 198,2 jt", delta: "18,4%", tone: "info", width: "61%", barClass: "bg-[#0a7ebf]" },
    { name: "PT Garuda Teknologi", value: "Rp 158,7 jt", delta: "13,9%", tone: "info", width: "49%", barClass: "bg-[#0a7ebf]" },
  ];

  // Hitung dinamis kontribusi per customer dari database Supabase
  const customers = useMemo(() => {
    if (!transactions.length) return defaultCustomers;

    const grandTotalActual = transactions.reduce((acc, t) => acc + (Number(t.actual_cost) || 0), 0);

    const map = new Map<string, { actual: number; planned: number }>();
    transactions.forEach((t) => {
      const name = t.customer_name || "Unknown Customer";
      const current = map.get(name) || { actual: 0, planned: 0 };
      map.set(name, {
        actual: current.actual + (Number(t.actual_cost) || 0),
        planned: current.planned + (Number(t.planned_cost) || 0),
      });
    });

    const list = Array.from(map.entries()).map(([name, val]) => {
      // 1. Hitung kontribusi terhadap total biaya perusahaan (%)
      const sharePct = grandTotalActual > 0 ? (val.actual / grandTotalActual) * 100 : 0;

      // 2. Cek apakah ada over budget pada customer ini
      const variance = val.actual - val.planned;
      const isOverBudget = variance > 0;

      // Format tampilan badge kontribusi
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
        name,
        actual: val.actual,
        value: formattedValue,
        delta: badgeText,
        tone,
        barClass: isOverBudget ? "bg-[#d4194f]" : "bg-[#0a7ebf]",
      };
    });

    // Urutkan customer dari nilai realisasi terbesar
    list.sort((a, b) => b.actual - a.actual);
    const maxVal = list[0]?.actual || 1;

    return list.slice(0, 4).map((item) => ({
      ...item,
      width: `${Math.max(15, Math.round((item.actual / maxVal) * 100))}%`,
    }));
  }, [transactions]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">Breakdown Cost per Customer</h3>
      <p className="text-[11px] text-slate-400">Kontribusi terhadap total cost</p>

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
    </div>
  );
}