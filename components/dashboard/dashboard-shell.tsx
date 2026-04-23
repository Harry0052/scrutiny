import { Landmark } from "lucide-react";

import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { DashboardGlobalSearch } from "@/components/search/dashboard-global-search";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
      <header className="panel mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-civic-800/80 via-civic-700/40 to-slate-900/90 px-4 py-5 sm:px-6">
          <div>
            <p className="panel-title mb-2 flex items-center gap-2 text-civic-100">
              <Landmark className="h-4 w-4" /> CivicWatch
            </p>
            <h1 className="text-xl font-semibold text-white sm:text-2xl">Automated Political Accountability Dashboard</h1>
          </div>
          <DashboardGlobalSearch />
        </div>
        <DashboardNav />
      </header>
      {children}
    </div>
  );
}
