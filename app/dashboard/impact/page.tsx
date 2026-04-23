import { Orbit } from "lucide-react";

import { EmptyDatasetState, MissingDatabaseState } from "@/components/dashboard/dashboard-states";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDashboardPageData } from "@/lib/services/page-data";

function toneForAlignment(alignment: string) {
  if (alignment.startsWith("Aligned")) {
    return "positive" as const;
  }
  if (alignment.startsWith("Misaligned")) {
    return "negative" as const;
  }
  if (alignment.startsWith("Partially")) {
    return "warning" as const;
  }
  return "neutral" as const;
}

export default async function ConstituentImpactPage({
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
    <section className="panel p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
        <Orbit className="h-5 w-5 text-civic-200" /> Constituent Impact Summary
      </h2>
      <div className="space-y-4">
        {data.constituentImpact.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">No impact records found.</p>
        ) : (
          data.constituentImpact.map((impact) => (
            <article key={impact.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">{impact.billCode}</p>
                <StatusBadge label={impact.alignment} tone={toneForAlignment(impact.alignment)} />
              </div>
              <p className="text-xs text-slate-300">{impact.billTitle}</p>
              <p className="mt-2 text-sm text-slate-100">Issue tag: {impact.issueTag}</p>
              <p className="mt-2 text-xs text-slate-300">Impact score: {Math.round(impact.impactScore * 100)}%</p>
              <p className="mt-1 text-xs text-slate-400">{impact.rationale}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
