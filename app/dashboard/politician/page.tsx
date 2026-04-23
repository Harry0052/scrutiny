import { CalendarDays, Landmark, UserSquare2 } from "lucide-react";

import { EmptyDatasetState, MissingDatabaseState } from "@/components/dashboard/dashboard-states";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDashboardPageData } from "@/lib/services/page-data";

export default async function PoliticianOverviewPage({
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
        <p className="panel-title mb-3">Politician Overview</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-slate-400">
              <UserSquare2 className="h-4 w-4" /> Name
            </p>
            <p className="font-semibold text-white">{data.politician.fullName}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-slate-400">
              <Landmark className="h-4 w-4" /> Office
            </p>
            <p className="font-semibold text-white">{data.politician.officeTitle}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <p className="mb-2 text-xs uppercase tracking-[0.12em] text-slate-400">Comparable Statements</p>
            <p className="text-xl font-semibold text-civic-100">{data.summary.totalComparableStatements}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-slate-400">
              <CalendarDays className="h-4 w-4" /> Honesty Score
            </p>
            <p className="text-xl font-semibold text-emerald-200">{data.summary.honestyScore.toFixed(2)}%</p>
          </div>
        </div>
      </section>

      <section className="panel p-5 sm:p-6">
        <p className="panel-title mb-3">Statements Timeline</p>
        <div className="space-y-3">
          {data.statementTimeline.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">No statements are available.</p>
          ) : (
            data.statementTimeline.map((statement) => (
              <article key={statement.id} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white">{new Date(statement.madeAt).toLocaleDateString("en-US")}</p>
                  <StatusBadge label={statement.sourceType} tone="neutral" />
                </div>
                <p className="text-sm text-slate-200">{statement.text}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
