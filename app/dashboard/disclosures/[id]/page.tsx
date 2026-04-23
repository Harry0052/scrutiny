import { notFound } from "next/navigation";

import { MissingDatabaseState } from "@/components/dashboard/dashboard-states";
import { ConfidenceBadge } from "@/components/evidence/confidence-badge";
import { getDisclosureDetail } from "@/lib/services/detail-records";
import { isDatabaseConfigured } from "@/lib/services/dashboard";

export default async function DisclosureDetailPage({ params }: { params: { id: string } }) {
  if (!isDatabaseConfigured()) {
    return <MissingDatabaseState />;
  }

  const disclosure = await getDisclosureDetail(params.id);
  if (!disclosure) {
    notFound();
  }

  return (
    <div className="grid gap-6">
      <section className="panel p-5 sm:p-6">
        <p className="panel-title mb-2">Financial Disclosure Record</p>
        <h2 className="text-xl font-semibold text-white">{disclosure.politician.fullName} - {disclosure.filingYear}</h2>
        <div className="mt-2"><ConfidenceBadge score={disclosure.extractionConfidence} /></div>
        <p className="mt-2 text-xs text-slate-300">Source: {disclosure.sourceUrl ?? "N/A"}</p>
      </section>
    </div>
  );
}
