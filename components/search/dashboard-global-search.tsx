"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";

import { GlobalSearchBar } from "@/components/search/global-search-bar";

export function DashboardGlobalSearch() {
  const router = useRouter();

  return (
    <GlobalSearchBar
      placeholder="Search candidates, officeholders, districts, or offices"
      onSearch={(query) => {
        const params = new URLSearchParams();
        if (query.trim()) {
          params.set("q", query.trim());
        }
        const href = params.toString() ? `/dashboard/search?${params.toString()}` : "/dashboard/search";
        router.push(href as Route);
      }}
      className="w-full max-w-xl"
    />
  );
}
