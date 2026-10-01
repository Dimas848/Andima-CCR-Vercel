import StatusBadge, { type Tone } from "./StatusBadge";

interface Customer {
  name: string;
  value: string;
  delta: string;
  tone: Tone;
  width: string;
  barClass: string;
}

const customers: Customer[] = [
  { name: "PT Nusantara Retail", value: "Rp 324,8 jt", delta: "+8.4%", tone: "danger", width: "100%", barClass: "bg-[#d4194f]" },
  { name: "PT Sinar Logistik", value: "Rp 271,5 jt", delta: "-2.1%", tone: "success", width: "83%", barClass: "bg-[#0a7ebf]" },
  { name: "CV Maju Bersama", value: "Rp 198,2 jt", delta: "+4.7%", tone: "warning", width: "61%", barClass: "bg-[#0a7ebf]" },
  { name: "PT Garuda Teknologi", value: "Rp 158,7 jt", delta: "-1.6%", tone: "success", width: "49%", barClass: "bg-[#0a7ebf]" },
];

export default function CustomerBreakdown() {
  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">Breakdown Cost per Customer</h3>
      <p className="text-[11px] text-slate-400">Kontribusi terhadap total cost</p>

      <div className="mt-5 flex flex-1 flex-col justify-between gap-4">
        {customers.map((c) => (
          <div key={c.name}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-slate-700">{c.name}</p>
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