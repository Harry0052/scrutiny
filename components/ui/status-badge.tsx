import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "positive" | "warning" | "negative";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "border-slate-500/30 bg-slate-700/40 text-slate-200",
  positive: "border-emerald-400/40 bg-emerald-600/25 text-emerald-100",
  warning: "border-amber-400/40 bg-amber-600/25 text-amber-100",
  negative: "border-rose-400/40 bg-rose-600/25 text-rose-100"
};

export function StatusBadge({
  label,
  tone = "neutral"
}: {
  label: string;
  tone?: BadgeTone;
}) {
  return (
    <span className={cn("rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em]", toneClasses[tone])}>
      {label}
    </span>
  );
}
