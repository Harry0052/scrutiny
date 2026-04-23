"use client";

import { ChevronDown, ChevronUp, FilterX } from "lucide-react";
import { useState } from "react";

import { countActiveFilters, type SearchFilterState } from "@/components/search/search-types";

export function AdvancedFiltersPanel({
  filters,
  onChange,
  onReset
}: {
  filters: SearchFilterState;
  onChange: (next: SearchFilterState) => void;
  onReset: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = countActiveFilters(filters);

  const update = <K extends keyof SearchFilterState>(key: K, value: SearchFilterState[K]) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-slate-950/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Advanced Filters
          <span className="rounded-full border border-civic-200/30 bg-civic-700/20 px-2 py-0.5 text-[10px] text-civic-100">
            {activeCount} active
          </span>
        </button>

        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-slate-900/70 px-3 py-2 text-xs uppercase tracking-[0.1em] text-slate-300 hover:border-white/20"
        >
          <FilterX className="h-3.5 w-3.5" /> Reset Filters
        </button>
      </div>

      {expanded ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select value={filters.scope} onChange={(event) => update("scope", event.target.value as SearchFilterState["scope"])} className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            <option value="all">All jurisdiction levels</option>
            <option value="local">Local</option>
            <option value="state">State</option>
            <option value="federal">Federal</option>
            <option value="national">National</option>
          </select>

          <select value={filters.figureStatus} onChange={(event) => update("figureStatus", event.target.value as SearchFilterState["figureStatus"])} className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            <option value="all">All figure statuses</option>
            <option value="OFFICEHOLDER">Current officeholders</option>
            <option value="CANDIDATE">Candidates</option>
            <option value="FORMER_OFFICEHOLDER">Former officeholders</option>
          </select>

          <select value={filters.incumbentStatus} onChange={(event) => update("incumbentStatus", event.target.value as SearchFilterState["incumbentStatus"])} className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            <option value="all">All candidacy statuses</option>
            <option value="INCUMBENT">Incumbent</option>
            <option value="CHALLENGER">Challenger</option>
            <option value="OPEN_SEAT">Open seat</option>
            <option value="UNKNOWN">Unknown</option>
          </select>

          <select value={filters.sortBy} onChange={(event) => update("sortBy", event.target.value as SearchFilterState["sortBy"])} className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            <option value="relevance">Sort by relevance</option>
            <option value="score">Sort by honesty score</option>
            <option value="donor_volume">Sort by donor volume</option>
            <option value="recent_votes">Sort by recent votes</option>
            <option value="disclosure_year">Sort by disclosure year</option>
          </select>

          <input value={filters.city} onChange={(event) => update("city", event.target.value)} placeholder="City" className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
          <input value={filters.county} onChange={(event) => update("county", event.target.value)} placeholder="County" className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
          <input value={filters.state} onChange={(event) => update("state", event.target.value)} placeholder="State (e.g., CA)" className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
          <input value={filters.district} onChange={(event) => update("district", event.target.value)} placeholder="District" className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
          <input value={filters.chamber} onChange={(event) => update("chamber", event.target.value)} placeholder="Chamber" className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
          <input value={filters.office} onChange={(event) => update("office", event.target.value)} placeholder="Office" className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
          <input value={filters.party} onChange={(event) => update("party", event.target.value)} placeholder="Party" className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
          <input value={filters.issueTag} onChange={(event) => update("issueTag", event.target.value)} placeholder="Issue focus" className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500" />

          <input value={filters.electionYear} onChange={(event) => update("electionYear", event.target.value)} placeholder="Election year" inputMode="numeric" className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
          <input value={filters.scoreMin} onChange={(event) => update("scoreMin", event.target.value)} placeholder="Min score" inputMode="decimal" className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
          <input value={filters.scoreMax} onChange={(event) => update("scoreMax", event.target.value)} placeholder="Max score" inputMode="decimal" className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
          <input value={filters.recentActivityDays} onChange={(event) => update("recentActivityDays", event.target.value)} placeholder="Recent activity (days)" inputMode="numeric" className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
        </div>
      ) : null}
    </section>
  );
}
