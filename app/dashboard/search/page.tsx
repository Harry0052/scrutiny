import { MissingDatabaseState } from "@/components/dashboard/dashboard-states";
import { SearchPageClient } from "@/components/search/search-page-client";
import { isDatabaseConfigured } from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";

export default function SearchPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  if (!isDatabaseConfigured()) {
    return <MissingDatabaseState />;
  }

  const queryValue = searchParams.q;
  const initialQuery = Array.isArray(queryValue) ? queryValue[0] ?? "" : queryValue ?? "";

  return <SearchPageClient initialQuery={initialQuery} />;
}
