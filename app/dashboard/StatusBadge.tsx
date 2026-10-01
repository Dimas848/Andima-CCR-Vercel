export type Tone = "success" | "danger" | "warning" | "info";

const tones: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-600",
  danger: "bg-rose-50 text-rose-600",
  warning: "bg-amber-50 text-amber-700",
  info: "bg-sky-50 text-sky-600",
};

export default function StatusBadge({ value, tone = "info" }: { value: string; tone?: Tone }) {
  return (
    <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${tones[tone]}`}>
      {value}
    </span>
  );
}