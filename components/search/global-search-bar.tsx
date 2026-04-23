"use client";

import { Clock3, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import type { PeopleSuggestion } from "@/lib/services/search/types";

const RECENT_SEARCHES_KEY = "civicwatch_recent_searches_v1";

function normalizeRecent(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function GlobalSearchBar({
  value,
  onValueChange,
  onSearch,
  placeholder = "Search politicians and candidates",
  className
}: {
  value?: string;
  onValueChange?: (nextValue: string) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [internalValue, setInternalValue] = useState(value ?? "");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<PeopleSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const query = value ?? internalValue;

  useEffect(() => {
    if (typeof value === "string") {
      setInternalValue(value);
    }
  }, [value]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      setRecentSearches(raw ? normalizeRecent(JSON.parse(raw)) : []);
    } catch {
      setRecentSearches([]);
    }
  }, []);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery || trimmedQuery.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(`suggestion request failed: ${response.status}`);
        }

        const payload = (await response.json()) as { suggestions?: PeopleSuggestion[] };
        setSuggestions(payload.suggestions ?? []);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  const showDropdown = useMemo(() => {
    if (!focused) {
      return false;
    }

    if (query.trim().length >= 2) {
      return loading || suggestions.length > 0;
    }

    return recentSearches.length > 0;
  }, [focused, loading, query, recentSearches.length, suggestions.length]);

  const updateQuery = (nextValue: string) => {
    setInternalValue(nextValue);
    onValueChange?.(nextValue);
  };

  const persistRecentSearch = (nextValue: string) => {
    const trimmed = nextValue.trim();
    if (!trimmed) {
      return;
    }

    const nextRecent = [trimmed, ...recentSearches.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
    setRecentSearches(nextRecent);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(nextRecent));
    } catch {
      // no-op when storage is unavailable
    }
  };

  const submit = (nextQuery: string) => {
    const trimmed = nextQuery.trim();
    updateQuery(trimmed);
    persistRecentSearch(trimmed);
    onSearch?.(trimmed);
    setFocused(false);
  };

  return (
    <div className={cn("relative", className)}>
      <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2.5">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit(query);
            }
          }}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
        />
      </label>

      {showDropdown ? (
        <div className="absolute z-30 mt-2 w-full rounded-xl border border-white/10 bg-slate-950/95 p-2 shadow-panel backdrop-blur">
          {query.trim().length >= 2 ? (
            <div className="space-y-1">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {loading ? "Loading suggestions" : "Suggestions"}
              </p>
              {suggestions.length === 0 && !loading ? (
                <p className="rounded-md border border-white/10 bg-slate-900/60 px-2 py-2 text-xs text-slate-300">
                  No suggestions yet. Press Enter to search all records.
                </p>
              ) : (
                suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => submit(suggestion.fullName)}
                    className="flex w-full items-center justify-between rounded-md border border-transparent px-2 py-2 text-left hover:border-white/10 hover:bg-slate-900/70"
                  >
                    <span>
                      <span className="block text-sm font-medium text-white">{suggestion.fullName}</span>
                      <span className="block text-xs text-slate-300">
                        {suggestion.officeDisplay}
                        {suggestion.state ? ` • ${suggestion.state}` : ""}
                      </span>
                    </span>
                    <Sparkles className="h-3.5 w-3.5 text-civic-200" />
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Recent searches</p>
              {recentSearches.map((item) => (
                <button
                  key={item}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => submit(item)}
                  className="flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-2 text-left text-sm text-slate-200 hover:border-white/10 hover:bg-slate-900/70"
                >
                  <Clock3 className="h-3.5 w-3.5 text-slate-400" /> {item}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
