import { GitCompareArrows } from "lucide-react";

import { EmptyDatasetState, MissingDatabaseState } from "@/components/dashboard/dashboard-states";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDashboardPageData } from "@/lib/services/page-data";

function toneForClassification(classification: "aligned" | "contradicted" | "unclear") {
  if (classification === "aligned") {
    return "positive" as const;
  }
  if (classification === "contradicted") {
    return "negative" as const;
  }
  return "warning" as const;
}

export default async function StatementComparisonPage({
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
        <GitCompareArrows className="h-5 w-5 text-civic-200" /> Statement vs Vote Comparison Feed
      </h2>
      <div className="space-y-4">
        {data.statementVoteFeed.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
            No comparable statement-vote records available.
          </p>
        ) : (
          data.statementVoteFeed.map((item) => (
            <article key={item.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <StatusBadge label={item.classification} tone={toneForClassification(item.classification)} />
                <span className="text-xs text-slate-400">confidence {Math.round(item.confidenceScore * 100)}%</span>
              </div>
              <p className="text-sm font-semibold text-white">{item.billCode}</p>
              <p className="text-xs text-slate-300">{item.billTitle}</p>
              <p className="mt-2 text-sm text-slate-100">{item.statementText}</p>
              <p className="mt-2 text-xs text-slate-300">{item.rationale}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
