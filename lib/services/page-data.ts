import { getDashboardData, isDatabaseConfigured } from "@/lib/services/dashboard";

export type DashboardPageDataResult =
  | { status: "missing_database" }
  | { status: "empty_dataset" }
  | { status: "ready"; data: NonNullable<Awaited<ReturnType<typeof getDashboardData>>> };

export async function getDashboardPageData(slug?: string): Promise<DashboardPageDataResult> {
  if (!isDatabaseConfigured()) {
    return { status: "missing_database" };
  }

  const data = await getDashboardData(slug);
  if (!data) {
    return { status: "empty_dataset" };
  }

  return { status: "ready", data };
}
