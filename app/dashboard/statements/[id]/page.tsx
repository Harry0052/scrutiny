import { notFound } from "next/navigation";

import { MissingDatabaseState } from "@/components/dashboard/dashboard-states";
import { ConfidenceBadge } from "@/components/evidence/confidence-badge";
import { getStatementDetail } from "@/lib/services/detail-records";
import { isDatabaseConfigured } from "@/lib/services/dashboard";

export default async function StatementDetailPage({ params }: { params: { id: string } }) {
  if (!isDatabaseConfigured()) {
    return <MissingDatabaseState />;
  }

  const statement = await getStatementDetail(params.id);
  if (!statement) {
    notFound();
  }

  return (
    <div className="grid gap-6">
      <section className="panel p-5 sm:p-6">
        <p className="panel-title mb-2">Statement Record</p>
        <h2 className="text-xl font-semibold text-white">{statement.politician.fullName}</h2>
        <p className="mt-2 text-sm text-slate-100">{statement.text}</p>
        <p className="mt-2 text-xs text-slate-400">Source: {statement.sourceLabel ?? statement.sourceType}</p>
      </section>

      <section className="panel p-5 sm:p-6">
        <p className="panel-title mb-2">Evidence Trail</p>
        <div className="space-y-3">
          {statement.analysisResults.map((analysis) => (
            <article key={analysis.id} className="rounded-lg border border-white/10 bg-slate-950/60 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">{analysis.classification}</p>
                <ConfidenceBadge score={analysis.confidenceScore} />
              </div>
              <p className="text-xs text-slate-300">{analysis.rationale}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
