"use client";

import type { Route } from "next";
import Link from "next/link";
import {
  ExternalLink,
  Globe,
  Landmark,
  Link2,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import type { PeopleSearchResult } from "@/lib/services/search/types";
import type { TrustLevel } from "@/lib/search-providers/types";

type WebResult = PeopleSearchResult & {
  sourceUrls?: string[];
  discoverySource?: string;
};

function trustIcon(trust: TrustLevel | string) {
  switch (trust) {
    case "official_government":
      return <Landmark className="h-3.5 w-3.5 text-emerald-400" />;
    case "official_election":
    case "official_campaign":
      return <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />;
    case "trusted_civic":
      return <Shield className="h-3.5 w-3.5 text-civic-300" />;
    case "news_media":
      return <Globe className="h-3.5 w-3.5 text-slate-300" />;
    default:
      return <ShieldAlert className="h-3.5 w-3.5 text-amber-300" />;
  }
}

function trustLabel(reason: string): { label: string; tone: "positive" | "warning" | "neutral" } {
  if (reason.includes("official_government")) {
    return { label: "gov source", tone: "positive" };
  }
  if (reason.includes("official_election")) {
    return { label: "election source", tone: "positive" };
  }
  if (reason.includes("trusted_civic")) {
    return { label: "civic source", tone: "positive" };
  }
  if (reason.includes("news_media")) {
    return { label: "news source", tone: "neutral" };
  }
  return { label: "web discovery", tone: "warning" };
}

function formatLocation(result: PeopleSearchResult): string {
  const parts = [result.city, result.county, result.state, result.district].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Location unavailable";
}

function statusLabel(result: PeopleSearchResult): string {
  if (result.candidateStatus === "OFFICEHOLDER") return "officeholder";
  if (result.candidateStatus === "CANDIDATE") return "candidate";
  return "former officeholder";
}

function statusTone(result: PeopleSearchResult) {
  if (result.candidateStatus === "OFFICEHOLDER") return "positive" as const;
  if (result.candidateStatus === "CANDIDATE") return "warning" as const;
  return "neutral" as const;
}

export function WebDiscoveryResults({
  results,
  loading,
  providerNotes,
  query,
}: {
  results: WebResult[];
  loading: boolean;
  providerNotes?: string[];
  query: string;
}) {
  if (loading) {
    return (
      <section className="panel p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <Globe className="h-4 w-4 text-civic-300" />
          <p className="panel-title">Web Discovery</p>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-xl border border-civic-700/20 bg-slate-900/70" />
          ))}
        </div>
      </section>
    );
  }

  if (results.length === 0 && !query.trim()) {
    return null;
  }

  if (results.length === 0) {
    return null; // Don't show empty web discovery section
  }

  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-civic-300" />
          <p className="panel-title">Web Discovery</p>
        </div>
        <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
          {results.length} discovered
        </p>
      </div>

      <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-900/10 px-3 py-2 text-xs text-amber-200/80">
        These results were discovered from the web and require verification.
        Trust levels are based on source domain analysis.
      </p>

      <div className="space-y-3">
        {results.map((result) => {
          const trust = trustLabel(result.relevanceReason);

          return (
            <article
              key={result.id}
              className="rounded-xl border border-civic-700/20 bg-slate-950/70 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{result.fullName}</h3>
                  <p className="text-sm text-slate-200">{result.officeDisplay}</p>
                  <p className="text-xs text-slate-400">{formatLocation(result)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={statusLabel(result)} tone={statusTone(result)} />
                  <StatusBadge label={trust.label} tone={trust.tone} />
                  <StatusBadge label={result.jurisdictionLevel.toLowerCase()} tone="neutral" />
                </div>
              </div>

              {result.latestActivitySummary ? (
                <p className="mt-2 text-xs text-slate-400 line-clamp-2">
                  {result.latestActivitySummary}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1 text-xs text-civic-200">
                  {trustIcon(result.relevanceReason.split("via ").pop()?.split(" ")[0] ?? "")}
                  <span className="capitalize">{result.relevanceReason}</span>
                </span>

                {result.sourceUrls && result.sourceUrls.length > 0 ? (
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Link2 className="h-3 w-3" />
                    {result.sourceUrls.length} source{result.sourceUrls.length > 1 ? "s" : ""}
                  </span>
                ) : null}
              </div>

              {result.sourceUrls && result.sourceUrls.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {result.sourceUrls.slice(0, 3).map((url) => {
                    let display: string;
                    try {
                      display = new URL(url).hostname.replace("www.", "");
                    } catch {
                      display = url.slice(0, 40);
                    }
                    return (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-slate-900/50 px-2 py-1 text-[10px] text-slate-300 hover:border-civic-500/30 hover:text-civic-200"
                      >
                        {display}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    );
                  })}
                </div>
              ) : null}

              <div className="mt-3 flex justify-end">
                <Link
                  href={`/dashboard?person=${encodeURIComponent(result.slug)}` as Route}
                  className="inline-flex items-center gap-1 rounded-md border border-civic-300/30 bg-civic-700/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-civic-100 hover:bg-civic-700/35"
                >
                  View Dashboard <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {providerNotes && providerNotes.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-[10px] uppercase tracking-[0.14em] text-slate-500 hover:text-slate-400">
            Provider diagnostics
          </summary>
          <div className="mt-2 space-y-1 rounded-lg border border-white/5 bg-slate-950/60 p-3">
            {providerNotes.map((note, i) => (
              <p key={i} className="font-mono text-[10px] text-slate-500">{note}</p>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
