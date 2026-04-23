import { Calculator } from "lucide-react";

import { EmptyDatasetState, MissingDatabaseState } from "@/components/dashboard/dashboard-states";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDashboardPageData } from "@/lib/services/page-data";

export default async function MethodologyPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const personSlug = typeof searchParams.person === "string" ? searchParams.person : undefined;
  const result = await getDashboardPageData(personSlug);

  if (result.status === "missing_database") {
    return <MissingDatabaseState />;
  }

  if (result.status === "empty_dataset") {
    return <EmptyDatasetState />;
  }

  const { data } = result;

  return (
    <div className="grid gap-6">
      <section className="panel p-5 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <Calculator className="h-5 w-5 text-civic-200" /> Methodology
        </h2>
        <div className="space-y-3 rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-slate-200">Method version</p>
            <StatusBadge label={data.methodology.version} tone="neutral" />
          </div>
          <p className="font-mono text-xs text-civic-100">{data.methodology.honesty_score_formula}</p>
          <ul className="space-y-2 text-sm text-slate-200">
            {data.methodology.notes.map((note) => (
              <li key={note} className="rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2">
                {note}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel p-5 sm:p-6">
        <p className="panel-title mb-3">Auditable Score Inputs</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Consistent Actions</p>
            <p className="mt-1 text-xl font-semibold text-emerald-200">{data.summary.consistentActions}</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Comparable Statements</p>
            <p className="mt-1 text-xl font-semibold text-civic-100">{data.summary.totalComparableStatements}</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Honesty Score</p>
            <p className="mt-1 text-xl font-semibold text-white">{data.summary.honestyScore.toFixed(2)}%</p>
          </article>
        </div>
      </section>
    </div>
  );
}
