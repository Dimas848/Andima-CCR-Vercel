import CustomButton from "./CustomButton";

const items = [
  { count: 9, label: "Over Budget", value: "Rp 186,2 jt", badge: "bg-rose-100 text-rose-600" },
  { count: 7, label: "High Cost", value: "Rp 128,7 jt", badge: "bg-pink-100 text-pink-600" },
  { count: 6, label: "Missing Evidence", value: "Rp 42,1 jt", badge: "bg-amber-100 text-amber-700" },
  { count: 4, label: "Duplicate Data", value: "Rp 18,4 jt", badge: "bg-violet-100 text-violet-600" },
];

export default function ExceptionSummary() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Ringkasan Exception</h3>
          <p className="text-[11px] text-slate-400">26 item memerlukan tindak lanjut</p>
        </div>
        <CustomButton variant="outline" size="sm">Lihat Semua</CustomButton>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {items.map((i) => (
          <div key={i.label} className="rounded-lg bg-slate-50 p-4">
            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold ${i.badge}`}>
              {i.count}
            </span>
            <p className="mt-2 text-[13px] font-bold text-slate-800">{i.label}</p>
            <p className="text-[13px] font-semibold text-slate-600">{i.value}</p>
            <p className="mt-1 text-[11px] text-slate-400">Perlu ditinjau</p>
          </div>
        ))}
      </div>
    </div>
  );
}