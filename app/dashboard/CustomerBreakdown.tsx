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
  // Nilai default persis sesuai tangkapan layar
  const defaultCustomers: Customer[] = [
    { name: "PT Nusantara Retail", value: "Rp 324,8 jt", delta: "+8,4%", tone: "danger", width: "100%", barClass: "bg-[#d4194f]" },
    { name: "PT Sinar Logistik", value: "Rp 271,5 jt", delta: "-2,1%", tone: "success", width: "83%", barClass: "bg-[#0a7ebf]" },
    { name: "CV Maju Bersama", value: "Rp 198,2 jt", delta: "+4,7%", tone: "warning", width: "61%", barClass: "bg-[#0a7ebf]" },
    { name: "PT Garuda Teknologi", value: "Rp 158,7 jt", delta: "-1,6%", tone: "success", width: "49%", barClass: "bg-[#0a7ebf]" },
  ];

  // Hitung dinamis dari transaksi live jika data tersedia
  const customers = useMemo(() => {
    if (!transactions.length) return defaultCustomers;

    const map = new Map<string, { actual: number; planned: number }>();
    transactions.forEach((t) => {
      const name = t.customer_name || "Unknown Customer";
      const current = map.get(name) || { actual: 0, planned: 0 };
      map.set(name, {
        actual: current.actual + (t.actual_cost || 0),
        planned: current.planned + (t.planned_cost || 0),
      });
    });

    const list = Array.from(map.entries()).map(([name, val]) => {
      const variance = val.actual - val.planned;
      const pct = val.planned > 0 ? (variance / val.planned) * 100 : 0;
      const deltaSign = pct > 0 ? `+${pct.toFixed(1).replace(".", ",")}%` : `${pct.toFixed(1).replace(".", ",")}%`;
      const tone: Tone = pct > 0 ? "danger" : "success";

      let formattedValue = `Rp ${val.actual.toLocaleString("id-ID")}`;
      if (Math.abs(val.actual) >= 1_000_000) {
        formattedValue = `Rp ${(val.actual / 1_000_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} jt`;
      }

      return {
        name,
        actual: val.actual,
        value: formattedValue,
        delta: deltaSign,
        tone,
        barClass: pct > 0 ? "bg-[#d4194f]" : "bg-[#0a7ebf]",
      };
    });

    list.sort((a, b) => b.actual - a.actual);
    const maxVal = list[0]?.actual || 1;

    return list.slice(0, 4).map((item) => ({
      ...item,
      width: `${Math.max(20, Math.round((item.actual / maxVal) * 100))}%`,
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