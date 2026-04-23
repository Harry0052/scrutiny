"use client";

import type { Route } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import type { PeopleSearchResult } from "@/lib/services/search/types";

function formatLocation(result: PeopleSearchResult): string {
  const parts = [result.city, result.county, result.state, result.district].filter(Boolean);
  return parts.length > 0 ? parts.join(" • ") : "Location unavailable";
}

function statusLabel(result: PeopleSearchResult): string {
  if (result.candidateStatus === "OFFICEHOLDER") {
    return "officeholder";
  }
  if (result.candidateStatus === "CANDIDATE") {
    return "candidate";
  }
  return "former officeholder";
}

function statusTone(result: PeopleSearchResult) {
  if (result.candidateStatus === "OFFICEHOLDER") {
    return "positive" as const;
  }
  if (result.candidateStatus === "CANDIDATE") {
    return "warning" as const;
  }
  return "neutral" as const;
}

export function SearchResultsList({
  results,
  loading,
  error,
  query
}: {
  results: PeopleSearchResult[];
  loading: boolean;
  error: string | null;
  query: string;
}) {
  if (loading) {
    return (
      <section className="panel p-5 sm:p-6">
        <p className="panel-title mb-3">Results</p>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-xl border border-white/10 bg-slate-900/70" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel p-5 sm:p-6">
        <p className="panel-title mb-3">Results</p>
        <p className="rounded-lg border border-rose-400/30 bg-rose-700/20 p-3 text-sm text-rose-100">{error}</p>
      </section>
    );
  }

  if (!query.trim()) {
    return (
      <section className="panel p-5 sm:p-6">
        <p className="panel-title mb-3">Results</p>
        <p className="rounded-lg border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
          Start typing to search political people only.
        </p>
      </section>
    );
  }

  if (results.length === 0) {
    return (
      <section className="panel p-5 sm:p-6">
        <p className="panel-title mb-3">Results</p>
        <p className="rounded-lg border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
          No politically relevant people matched &quot;{query}&quot;.
        </p>
      </section>
    );
  }

  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="panel-title">Results</p>
        <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{results.length} political records</p>
      </div>

      <div className="space-y-3">
        {results.map((result) => (
          <article key={result.id} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{result.fullName}</h3>
                <p className="text-sm text-slate-200">{result.officeDisplay}</p>
                <p className="text-xs text-slate-400">{formatLocation(result)}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={statusLabel(result)} tone={statusTone(result)} />
                <StatusBadge label={result.jurisdictionLevel.toLowerCase()} tone="neutral" />
              </div>
            </div>

            <p className="mt-3 text-xs text-civic-100">Relevance: {result.relevanceReason}</p>

            <div className="mt-3 flex justify-end">
              <Link
                href={`/dashboard?person=${encodeURIComponent(result.slug)}` as Route}
                className="inline-flex items-center gap-1 rounded-md border border-civic-300/30 bg-civic-700/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-civic-100 hover:bg-civic-700/35"
              >
                View Dashboard <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
