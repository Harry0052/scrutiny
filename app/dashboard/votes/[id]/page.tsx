import { notFound } from "next/navigation";

import { MissingDatabaseState } from "@/components/dashboard/dashboard-states";
import { getVoteDetail } from "@/lib/services/detail-records";
import { isDatabaseConfigured } from "@/lib/services/dashboard";

export default async function VoteDetailPage({ params }: { params: { id: string } }) {
  if (!isDatabaseConfigured()) {
    return <MissingDatabaseState />;
  }

  const vote = await getVoteDetail(params.id);
  if (!vote) {
    notFound();
  }

  return (
    <div className="grid gap-6">
      <section className="panel p-5 sm:p-6">
        <p className="panel-title mb-2">Vote Record</p>
        <h2 className="text-xl font-semibold text-white">{vote.bill.billCode} - {vote.bill.title}</h2>
        <p className="mt-2 text-sm text-slate-200">Vote position: {vote.votePosition}</p>
        <p className="mt-1 text-xs text-slate-400">Roll call: {vote.rollCallReference ?? "N/A"}</p>
      </section>
    </div>
  );
}
