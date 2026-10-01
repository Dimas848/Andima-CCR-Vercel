import type { LucideIcon } from "lucide-react";
import StatusBadge, { type Tone } from "./StatusBadge";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  iconClass: string;
  badge?: { value: string; tone: Tone };
}

export default function KpiCard({ title, value, subtitle, icon: Icon, iconClass, badge }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-bold tracking-wider text-slate-500">{title}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-1 flex items-center gap-3">
        <h2 className="text-2xl font-extrabold text-slate-900">{value}</h2>
        {badge && <StatusBadge value={badge.value} tone={badge.tone} />}
      </div>
      <p className="mt-1 text-[11px] text-slate-400">{subtitle}</p>
    </div>
  );
}