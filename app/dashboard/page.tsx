import { EmptyDatasetState, MissingDatabaseState } from "@/components/dashboard/dashboard-states";
import { InvestigationWorkbench } from "@/components/dashboard/investigation-workbench";
import { getDashboardPageData } from "@/lib/services/page-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
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

  return <InvestigationWorkbench data={result.data} />;
}
