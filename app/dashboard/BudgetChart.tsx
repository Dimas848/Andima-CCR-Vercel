import StatusBadge from "./StatusBadge";

const data = [
  { month: "Apr", budget: 150, actual: 143 },
  { month: "Mei", budget: 165, actual: 157 },
  { month: "Jun", budget: 172, actual: 169 },
  { month: "Jul", budget: 181, actual: 176 },
  { month: "Agu", budget: 189, actual: 196 },
  { month: "Sep", budget: 172, actual: 184 },
];

const max = Math.max(...data.map((d) => Math.max(d.budget, d.actual)));

export default function BudgetChart() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Budget vs Actual</h3>
          <p className="text-[11px] text-slate-400">Nilai dalam juta rupiah · 6 bulan terakhir</p>
        </div>
        <StatusBadge value="Aktual +7.1%" tone="danger" />
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px] font-semibold text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#0a7ebf]" /> Budget
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#d4194f]" /> Actual
        </span>
      </div>

      <div className="mt-4 flex h-56 items-end justify-between gap-2 border-b border-slate-100">
        {data.map((d) => (
          <div key={d.month} className="flex h-full flex-1 items-end justify-center gap-1.5">
            <div
              className="w-3.5 rounded-t bg-[#0a7ebf]"
              style={{ height: `${(d.budget / max) * 100}%` }}
            />
            <div
              className="w-3.5 rounded-t bg-[#d4194f]"
              style={{ height: `${(d.actual / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between gap-2">
        {data.map((d) => (
          <span key={d.month} className="flex-1 text-center text-[11px] font-semibold text-slate-400">
            {d.month}
          </span>
        ))}
      </div>
    </div>
  );
}