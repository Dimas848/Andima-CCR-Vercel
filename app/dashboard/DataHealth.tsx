const percent = 94;
const radius = 34;
const circumference = 2 * Math.PI * radius;
const offset = circumference * (1 - percent / 100);

export default function DataHealth() {
  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">Kesehatan Data</h3>
      <p className="text-[11px] text-slate-400">Pemeriksaan otomatis terakhir 08:42</p>

      <div className="mt-5 flex items-center gap-5">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
            <circle cx="40" cy="40" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="7" />
            <circle
              cx="40" cy="40" r={radius} fill="none"
              stroke="#16a34a" strokeWidth="7" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-lg font-extrabold text-emerald-600">
            {percent}%
          </span>
        </div>
        <div>
          <p className="text-sm font-bold text-emerald-600">Data cukup sehat</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            4,280 record valid · 26 exception · 8 dokumen belum lengkap.
          </p>
        </div>
      </div>

      <div className="mt-auto pt-5">
        <div className="h-1.5 rounded-full bg-slate-100">
          <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}