import { notFound } from "next/navigation";

import { MissingDatabaseState } from "@/components/dashboard/dashboard-states";
import { getDonorContributionDetail } from "@/lib/services/detail-records";
import { isDatabaseConfigured } from "@/lib/services/dashboard";

export default async function DonorDetailPage({ params }: { params: { id: string } }) {
  if (!isDatabaseConfigured()) {
    return <MissingDatabaseState />;
  }

  const contribution = await getDonorContributionDetail(params.id);
  if (!contribution) {
    notFound();
  }

  return (
    <div className="grid gap-6">
      <section className="panel p-5 sm:p-6">
        <p className="panel-title mb-2">Donor Record</p>
        <h2 className="text-xl font-semibold text-white">{contribution.donor.name}</h2>
        <p className="mt-2 text-sm text-slate-200">Amount: ${Math.round(Number(contribution.amountUsd)).toLocaleString()}</p>
        <p className="mt-1 text-xs text-slate-400">Cycle: {contribution.electionCycle} | Source: {contribution.sourceSystem}</p>
      </section>
    </div>
  );
}
