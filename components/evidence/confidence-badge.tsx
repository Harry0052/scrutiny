import { cn } from "@/lib/utils";

export function ConfidenceBadge({ score }: { score?: number | null }) {
  if (typeof score !== "number") {
    return <span className="rounded-full border border-slate-500/30 bg-slate-700/40 px-2 py-1 text-xs text-slate-200">No confidence score</span>;
  }

  const percentage = Math.round(score * 100);
  const tone =
    percentage >= 80
      ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-100"
      : percentage >= 55
        ? "border-amber-400/40 bg-amber-500/20 text-amber-100"
        : "border-rose-400/40 bg-rose-500/20 text-rose-100";

  return (
    <span className={cn("rounded-full border px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em]", tone)}>
      Confidence {percentage}%
    </span>
  );
}
