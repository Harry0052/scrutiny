"use client";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Globe, Info } from "lucide-react";

import { GlobalSearchBar } from "@/components/search/global-search-bar";
import { SearchResultsList } from "@/components/search/search-results-list";
import { WebDiscoveryResults } from "@/components/search/web-discovery-results";
import type { PeopleSearchResult } from "@/lib/services/search/types";

type WebResult = PeopleSearchResult & {
  sourceUrls?: string[];
  discoverySource?: string;
};

interface SearchApiResponse {
  results?: PeopleSearchResult[];
  hydrated?: boolean;
  hydrationSummary?: { providerNotes?: string[] };
  newsCrossCheck?: { articleCount?: number; sources?: string[] };
  webDiscovery?: {
    providerUsed?: boolean;
    rawResultCount?: number;
    validatedResultCount?: number;
    resultCount?: number;
    providerNotes?: string[];
  };
}

export function SearchPageClient({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<PeopleSearchResult[]>([]);
  const [webResults, setWebResults] = useState<WebResult[]>([]);
  const [webProviderNotes, setWebProviderNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(initialQuery.trim()));
  const [webLoading, setWebLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [hydratedQueries, setHydratedQueries] = useState<string[]>([]);
  const [webDiscoveryEnabled, setWebDiscoveryEnabled] = useState(true);

  // Sync URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set("q", query.trim());
    }
    const href = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(href as Route, { scroll: false });
  }, [query, pathname, router]);

  // Run web discovery as a separate request when primary results are sparse
  const runWebDiscovery = useCallback(
    async (searchQuery: string, primaryResultCount: number) => {
      if (!webDiscoveryEnabled || searchQuery.length < 3 || primaryResultCount >= 5) {
        setWebResults([]);
        setWebProviderNotes([]);
        return;
      }

      try {
        setWebLoading(true);
        const params = new URLSearchParams({ q: searchQuery, limit: "8" });
        const response = await fetch(`/api/search/discover?${params.toString()}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          setWebResults([]);
          return;
        }

        const payload = (await response.json()) as {
          results?: WebResult[];
          providerNotes?: string[];
          available?: boolean;
        };

        setWebResults(payload.results ?? []);
        setWebProviderNotes(payload.providerNotes ?? []);
      } catch {
        setWebResults([]);
      } finally {
        setWebLoading(false);
      }
    },
    [webDiscoveryEnabled]
  );

  // Primary search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setWebResults([]);
      setLoading(false);
      setError(null);
      setInfoMessage(null);
      return;
    }

    const params = new URLSearchParams();
    params.set("q", trimmed);
    params.set("limit", "20");

    const normalized = trimmed.toLowerCase();
    const shouldHydrate = normalized.length >= 3 && !hydratedQueries.includes(normalized);
    if (shouldHydrate) {
      params.set("hydrate", "1");
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        setInfoMessage(null);

        const response = await fetch(`/api/search/people?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`search failed: ${response.status}`);
        }

        const payload = (await response.json()) as SearchApiResponse;
        const searchResults = payload.results ?? [];
        setResults(searchResults);

        if (shouldHydrate && (searchResults.length > 0 || payload.hydrated)) {
          setHydratedQueries((existing) =>
            existing.includes(normalized) ? existing : [...existing, normalized]
          );
        }

        if (payload.hydrated) {
          const providerNote = payload.hydrationSummary?.providerNotes?.find(Boolean);
          setInfoMessage(
            providerNote ?? "Live political-source ingestion completed for this query."
          );
        } else if ((payload.newsCrossCheck?.articleCount ?? 0) > 0) {
          const sourceList = (payload.newsCrossCheck?.sources ?? []).slice(0, 3).join(", ");
          setInfoMessage(
            `Google News cross-check: ${payload.newsCrossCheck?.articleCount} related article(s)${
              sourceList ? ` from ${sourceList}` : ""
            }.`
          );
        }

        // Run web discovery if primary results are sparse
        void runWebDiscovery(trimmed, searchResults.length);
      } catch {
        if (!controller.signal.aborted) {
          setError("Search failed. Check database/provider configuration and try again.");
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 240);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query, hydratedQueries, runWebDiscovery]);

  return (
    <div className="space-y-6">
      <section className="panel p-5 sm:p-6">
        <p className="panel-title mb-1">Political People Search</p>
        <h2 className="text-xl font-semibold text-white">
          Find officeholders and candidates from city level to national level
        </h2>

        <div className="mt-4">
          <GlobalSearchBar
            value={query}
            onValueChange={setQuery}
            onSearch={setQuery}
            placeholder="Search by name, office, city, state, district, or race"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            Results are limited to records with political-office or candidacy evidence.
          </p>

          <button
            type="button"
            onClick={() => setWebDiscoveryEnabled((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
              webDiscoveryEnabled
                ? "border-civic-500/30 bg-civic-700/20 text-civic-200"
                : "border-white/10 bg-slate-900/50 text-slate-400"
            }`}
          >
            <Globe className="h-3 w-3" />
            Web Discovery {webDiscoveryEnabled ? "On" : "Off"}
          </button>
        </div>

        {infoMessage ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-civic-100">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            {infoMessage}
          </p>
        ) : null}
      </section>

      <SearchResultsList results={results} loading={loading} error={error} query={query} />

      {webDiscoveryEnabled ? (
        <WebDiscoveryResults
          results={webResults}
          loading={webLoading}
          providerNotes={webProviderNotes}
          query={query}
        />
      ) : null}
    </div>
  );
}
