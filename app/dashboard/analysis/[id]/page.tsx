import { notFound } from "next/navigation";

import { MissingDatabaseState } from "@/components/dashboard/dashboard-states";
import { ConfidenceBadge } from "@/components/evidence/confidence-badge";
import { getAnalysisDetail } from "@/lib/services/detail-records";
import { isDatabaseConfigured } from "@/lib/services/dashboard";

export default async function AnalysisDetailPage({ params }: { params: { id: string } }) {
  if (!isDatabaseConfigured()) {
    return <MissingDatabaseState />;
  }

  const analysis = await getAnalysisDetail(params.id);
  if (!analysis) {
    notFound();
  }

  return (
    <div className="grid gap-6">
      <section className="panel p-5 sm:p-6">
        <p className="panel-title mb-2">Analysis Result Record</p>
        <h2 className="text-xl font-semibold text-white">{analysis.classification}</h2>
        <div className="mt-2"><ConfidenceBadge score={analysis.confidenceScore} /></div>
        <p className="mt-2 text-sm text-slate-200">{analysis.rationale}</p>
        <p className="mt-2 text-xs text-slate-300">Statement: {analysis.statement.text}</p>
        <p className="mt-1 text-xs text-slate-400">Bill: {analysis.bill?.billCode ?? "N/A"} | Vote: {analysis.vote?.votePosition ?? "N/A"}</p>
      </section>
    </div>
  );
}
