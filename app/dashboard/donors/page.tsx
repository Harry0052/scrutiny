import { CircleDollarSign } from "lucide-react";

import { EmptyDatasetState, MissingDatabaseState } from "@/components/dashboard/dashboard-states";
import { getDashboardPageData } from "@/lib/services/page-data";

function currency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export default async function DonorInfluencePage({
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
  const maxAmount = Math.max(...data.donorSummary.map((item) => item.amountUsd), 1);

  return (
    <section className="panel p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
        <CircleDollarSign className="h-5 w-5 text-civic-200" /> Donor Influence Summary
      </h2>
      <div className="space-y-3">
        {data.donorSummary.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">No donor contributions found.</p>
        ) : (
          data.donorSummary.map((donor) => (
            <article key={donor.sector} className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium capitalize text-white">{donor.sector.replaceAll("_", " ")}</p>
                <p className="text-sm text-civic-100">{currency(donor.amountUsd)}</p>
              </div>
              <div className="h-2 rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-civic-500 to-civic-300"
                  style={{ width: `${Math.max(6, Math.round((donor.amountUsd / maxAmount) * 100))}%` }}
                />
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
