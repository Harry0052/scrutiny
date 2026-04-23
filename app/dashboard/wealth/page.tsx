import { BriefcaseBusiness } from "lucide-react";

import { EmptyDatasetState, MissingDatabaseState } from "@/components/dashboard/dashboard-states";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDashboardPageData } from "@/lib/services/page-data";

function toneForStatus(label: string) {
  if (label === "Parsed") {
    return "positive" as const;
  }
  if (label === "Partially parsed") {
    return "warning" as const;
  }
  if (label === "Failed") {
    return "negative" as const;
  }
  return "neutral" as const;
}

export default async function WealthTrackerPage({
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
        <BriefcaseBusiness className="h-5 w-5 text-civic-200" /> Wealth Tracker
      </h2>

      {!data.wealthSummary ? (
        <p className="rounded-lg border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">No parsed disclosure files available.</p>
      ) : (
        <div className="space-y-4">
          <article className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Filing Year</p>
                <p className="text-lg font-semibold text-white">{data.wealthSummary.filingYear}</p>
              </div>
              <StatusBadge label={data.wealthSummary.extractionStatus} tone={toneForStatus(data.wealthSummary.extractionStatus)} />
            </div>
            <p className="mt-2 text-sm text-slate-200">
              Extraction confidence: {Math.round((data.wealthSummary.extractionConfidence ?? 0) * 100)}%
            </p>
          </article>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-center">
              <p className="text-xs text-slate-400">Assets</p>
              <p className="mt-1 text-xl font-semibold text-white">{data.wealthSummary.assets.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-center">
              <p className="text-xs text-slate-400">Liabilities</p>
              <p className="mt-1 text-xl font-semibold text-white">{data.wealthSummary.liabilities.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-center">
              <p className="text-xs text-slate-400">Income Sources</p>
              <p className="mt-1 text-xl font-semibold text-white">{data.wealthSummary.incomeSources.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-center">
              <p className="text-xs text-slate-400">Transactions</p>
              <p className="mt-1 text-xl font-semibold text-white">{data.wealthSummary.transactions.length}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
