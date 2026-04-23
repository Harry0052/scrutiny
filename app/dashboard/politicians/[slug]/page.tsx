import { notFound } from "next/navigation";

import { MissingDatabaseState } from "@/components/dashboard/dashboard-states";
import { StatusBadge } from "@/components/ui/status-badge";
import { getPoliticianProfileDetail } from "@/lib/services/detail-records";
import { isDatabaseConfigured } from "@/lib/services/dashboard";

export default async function PoliticianProfileDetailPage({ params }: { params: { slug: string } }) {
  if (!isDatabaseConfigured()) {
    return <MissingDatabaseState />;
  }

  const profile = await getPoliticianProfileDetail(params.slug);
  if (!profile) {
    notFound();
  }

  const donorTotal = profile.donorContributions.reduce((total, item) => total + Number(item.amountUsd), 0);

  return (
    <div className="grid gap-6">
      <section className="panel p-5 sm:p-6">
        <p className="panel-title mb-2">Politician Profile</p>
        <h2 className="text-2xl font-semibold text-white">{profile.fullName}</h2>
        <p className="mt-1 text-sm text-slate-300">{profile.officeTitle} {profile.jurisdictionState ? `(${profile.jurisdictionState})` : ""}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge label={profile.party ?? "N/A"} tone="neutral" />
          <StatusBadge label={profile.chamber ?? "N/A"} tone="neutral" />
          <StatusBadge label={profile.jurisdictionLevel} tone="neutral" />
          <StatusBadge label={profile.candidateStatus.toLowerCase().replaceAll("_", " ")} tone="neutral" />
          <StatusBadge label={profile.incumbentChallengerStatus.toLowerCase().replaceAll("_", " ")} tone="neutral" />
        </div>
        {profile.officeSought ? (
          <p className="mt-3 text-xs text-slate-300">Office sought: {profile.officeSought}</p>
        ) : null}
        {profile.votes.length === 0 ? (
          <p className="mt-3 rounded-md border border-amber-400/30 bg-amber-600/20 px-3 py-2 text-xs text-amber-100">
            No legislative voting record is available for this profile.
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <article className="panel p-4 text-center"><p className="text-xs text-slate-400">Latest Statements</p><p className="mt-1 text-xl font-semibold text-white">{profile.statements.length}</p></article>
        <article className="panel p-4 text-center"><p className="text-xs text-slate-400">Latest Votes</p><p className="mt-1 text-xl font-semibold text-white">{profile.votes.length}</p></article>
        <article className="panel p-4 text-center"><p className="text-xs text-slate-400">Donor Records</p><p className="mt-1 text-xl font-semibold text-white">{profile.donorContributions.length}</p></article>
        <article className="panel p-4 text-center"><p className="text-xs text-slate-400">Donor Volume</p><p className="mt-1 text-xl font-semibold text-civic-100">${Math.round(donorTotal).toLocaleString()}</p></article>
      </section>

      <section className="panel p-5 sm:p-6">
        <p className="panel-title mb-3">Profile Metadata</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-lg border border-white/10 bg-slate-950/60 p-3">
            <p className="mb-1 text-xs uppercase tracking-[0.12em] text-slate-400">Aliases</p>
            <p className="text-sm text-slate-200">{profile.aliases.length > 0 ? profile.aliases.map((item) => item.alias).join(", ") : "No aliases recorded"}</p>
          </article>
          <article className="rounded-lg border border-white/10 bg-slate-950/60 p-3">
            <p className="mb-1 text-xs uppercase tracking-[0.12em] text-slate-400">Prior Office History</p>
            <p className="text-sm text-slate-200">
              {profile.officeHistory.length > 0
                ? profile.officeHistory
                    .map((item) => `${item.officeTitle}${item.electionYear ? ` (${item.electionYear})` : ""}`)
                    .join(", ")
                : "No office history records yet"}
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
