"use client";

import { AlertTriangle, ExternalLink, Gauge, HandCoins, Loader2, Scale, Search, ShieldCheck, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { ChatbotWidget } from "@/components/civicwatch/chatbot-widget";
import { GlobalSearchBar } from "@/components/search/global-search-bar";

interface TruthEngineStatementResult {
  statement_id: string;
  bill_id: string;
  classification: "aligned" | "contradicted" | "unclear";
  confidence_score: number;
  rationale: string;
  statement_text: string;
  vote_position: string | null;
  bill_title: string;
  issue_tags: string[];
  statement_source_url?: string | null;
}

interface TruthEngineResponse {
  status: "ok" | "not_found" | "unavailable";
  query: string;
  topic: string;
  generatedAt: string;
  politician?: {
    fullName: string;
    party: string | null;
    officeTitle: string;
    jurisdictionState: string | null;
    jurisdictionLevel: "LOCAL" | "STATE" | "NATIONAL";
  };
  summary?: {
    consistent_actions: number;
    total_statements: number;
    honesty_score: number;
  };
  honesty_formula: string;
  statement_results: TruthEngineStatementResult[];
  donor_insights: Array<{
    donorName: string;
    donorSector: string;
    totalAmountUsd: number;
    conflictActions: Array<{
      billCode: string;
      billTitle: string;
      votePosition: string;
      matchReason: string;
    }>;
  }>;
  wealth_tracker: {
    trend: Array<{ year: number; netWorthEstimateUsd: number }>;
    salaryBenchmarkUsd: number;
  };
  constituent_impact: {
    alignedCount: number;
    misalignedCount: number;
    insufficientCount: number;
    status: "green" | "red" | "mixed";
  };
  grounding: {
    google_queries: Array<{
      query: string;
      status: "ok" | "error" | "unconfigured" | "rate_limited";
      note: string;
      results: Array<{ title: string; link: string; snippet: string }>;
    }>;
    fact_checks: Array<{
      claim: string;
      publisher?: string;
      reviewRating?: string;
      reviewUrl?: string;
    }>;
    news_cross_check: {
      articleCount: number;
      sources: string[];
    } | null;
  };
  methodology_notes: string[];
  warnings: string[];
  user_qa: {
    available: boolean;
    note?: string;
    items: Array<{
      question: string;
      answer: string;
      confidence_score: number;
      evidence_links: string[];
    }>;
  };
  research_fallback: {
    notes: string[];
  };
}

function classificationClass(value: TruthEngineStatementResult["classification"]): string {
  if (value === "aligned") {
    return "border-emerald-400/40 bg-emerald-500/15 text-emerald-100";
  }

  if (value === "contradicted") {
    return "border-rose-400/40 bg-rose-500/15 text-rose-100";
  }

  return "border-amber-400/40 bg-amber-500/15 text-amber-100";
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function statusTone(status: TruthEngineResponse["constituent_impact"]["status"]): string {
  if (status === "green") {
    return "text-emerald-200";
  }
  if (status === "red") {
    return "text-rose-200";
  }
  return "text-amber-200";
}

function buildSparkPoints(points: Array<{ year: number; netWorthEstimateUsd: number }>): string {
  if (points.length < 2) {
    return "";
  }

  const values = points.map((point) => point.netWorthEstimateUsd);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 100 - ((point.netWorthEstimateUsd - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");
}

export function CivicWatchOnePageDashboard() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState<TruthEngineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async (nextQuery: string) => {
    const trimmed = nextQuery.trim();
    setQuery(trimmed);

    if (!trimmed) {
      setResult(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ q: trimmed });
      if (topic.trim()) {
        params.set("topic", topic.trim());
      }

      const response = await fetch(`/api/truth-engine?${params.toString()}`, {
        cache: "no-store",
      });

      const payload = (await response.json()) as TruthEngineResponse & { error?: string };
      if (!response.ok) {
        if (payload.status === "not_found") {
          setError("No matching political profile with analyzable records was found.");
          setResult(payload);
          return;
        }

        if (payload.status === "unavailable") {
          setError("Database is not configured. Add DATABASE_URL to run full analysis.");
          setResult(payload);
          return;
        }

        throw new Error(payload.error || "Request failed");
      }

      setResult(payload);
    } catch {
      setError("Truth engine request failed. Verify API keys and database connectivity.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const score = result?.summary?.honesty_score ?? 0;
  const scoreAngle = Math.max(0, Math.min(100, score)) * 3.6;

  const maxDonorAmount = useMemo(() => {
    return Math.max(...(result?.donor_insights.map((item) => item.totalAmountUsd) ?? [1]));
  }, [result?.donor_insights]);

  const sparkLine = useMemo(() => buildSparkPoints(result?.wealth_tracker.trend ?? []), [result?.wealth_tracker.trend]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <section className="panel p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="panel-title mb-1">CivicWatch</p>
            <h1 className="text-2xl font-semibold text-white">Evidence-first political accountability dashboard</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Search a public political figure and CivicWatch will cross-check statements, votes, donor records, disclosures,
              and grounded web evidence.
            </p>
          </div>

          <div className="rounded-xl border border-civic-300/25 bg-civic-700/20 px-3 py-2 text-xs text-civic-100">
            National, state, and local scope
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px_120px]">
          <GlobalSearchBar
            value={query}
            onValueChange={setQuery}
            onSearch={(value) => {
              void runSearch(value);
            }}
            placeholder="Search politician or candidate (name, office, city, county, state, district)"
          />

          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Optional topic (healthcare, housing, taxes)"
            className="rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
          />

          <button
            type="button"
            onClick={() => {
              void runSearch(query);
            }}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-civic-300/30 bg-civic-700/25 px-3 py-2.5 text-sm font-semibold text-civic-100 transition hover:bg-civic-700/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Analyze
          </button>
        </div>
      </section>

      {error ? (
        <section className="panel border-rose-400/30 bg-rose-700/15 p-5 text-sm text-rose-100">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        </section>
      ) : null}

      {!result && !loading ? (
        <section className="panel p-8 text-center">
          <p className="text-sm text-slate-300">Run a search to generate a grounded truth analysis.</p>
        </section>
      ) : null}

      {loading ? (
        <section className="panel p-6">
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <Loader2 className="h-4 w-4 animate-spin" /> Running Truth Engine...
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="h-44 animate-pulse rounded-xl border border-white/10 bg-slate-900/70" />
            <div className="h-44 animate-pulse rounded-xl border border-white/10 bg-slate-900/70" />
          </div>
        </section>
      ) : null}

      {result?.status === "ok" && result.politician && result.summary ? (
        <>
          <section className="grid gap-4 lg:grid-cols-2">
            <article className="panel p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                  <Gauge className="h-4 w-4 text-civic-100" /> Truth Score
                </h2>
                <span className="text-xs text-slate-400">{result.honesty_formula}</span>
              </div>

              <div className="flex flex-wrap items-center gap-5">
                <div
                  className="relative h-28 w-28 rounded-full"
                  style={{
                    background: `conic-gradient(#3ee37d ${scoreAngle}deg, rgba(148,163,184,0.2) ${scoreAngle}deg 360deg)`,
                  }}
                >
                  <div className="absolute inset-[10px] flex items-center justify-center rounded-full bg-slate-950 text-lg font-semibold text-white">
                    {score.toFixed(1)}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-lg font-semibold text-white">{result.politician.fullName}</p>
                  <p className="text-sm text-slate-300">
                    {result.politician.officeTitle}
                    {result.politician.jurisdictionState ? ` • ${result.politician.jurisdictionState}` : ""}
                  </p>
                  <p className="text-xs text-slate-400">
                    Consistent actions: {result.summary.consistent_actions} / {result.summary.total_statements} comparable statements
                  </p>
                </div>
              </div>
            </article>

            <article className="panel p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                  <HandCoins className="h-4 w-4 text-civic-100" /> Donor Influence Map
                </h2>
                <span className="text-xs text-slate-400">Top 5 donors</span>
              </div>

              <div className="space-y-3">
                {result.donor_insights.length === 0 ? (
                  <p className="text-sm text-slate-400">No donor records available for this profile.</p>
                ) : (
                  result.donor_insights.map((donor) => {
                    const width = `${Math.max(6, (donor.totalAmountUsd / maxDonorAmount) * 100)}%`;
                    return (
                      <div key={`${donor.donorName}-${donor.donorSector}`}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-300">
                          <span>{donor.donorName}</span>
                          <span>{formatUsd(donor.totalAmountUsd)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-800">
                          <div className="h-2 rounded-full bg-civic-300" style={{ width }} />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {donor.donorSector} • {donor.conflictActions.length} potential conflict action(s)
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </article>
          </section>

          <section className="panel p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <Search className="h-4 w-4 text-civic-100" /> OpenAI Briefing
              </h2>
              <span className="text-xs text-slate-400">{result.user_qa.available ? "Model-generated" : "Deterministic fallback"}</span>
            </div>

            {result.user_qa.note ? <p className="mb-3 text-xs text-slate-400">{result.user_qa.note}</p> : null}

            <div className="space-y-3">
              {result.user_qa.items.length === 0 ? (
                <p className="text-sm text-slate-400">No briefing answers available yet.</p>
              ) : (
                result.user_qa.items.map((item) => (
                  <article key={`${item.question}-${item.answer.slice(0, 24)}`} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                    <p className="text-sm font-semibold text-white">{item.question}</p>
                    <p className="mt-2 text-sm text-slate-200">{item.answer}</p>
                    <p className="mt-2 text-xs text-slate-400">Confidence {Math.round(item.confidence_score * 100)}%</p>
                    {item.evidence_links.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.evidence_links.slice(0, 3).map((link) => (
                          <a
                            key={`${item.question}-${link}`}
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-civic-300/25 bg-civic-700/15 px-2 py-1 text-[11px] text-civic-100"
                          >
                            Evidence <ExternalLink className="h-3 w-3" />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="panel p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <Scale className="h-4 w-4 text-civic-100" /> Statement vs Vote Feed
              </h2>
              <span className="text-xs text-slate-400">Evidence-linked classifications</span>
            </div>

            <div className="space-y-3">
              {result.statement_results.length === 0 ? (
                <p className="text-sm text-slate-400">No comparable statements available.</p>
              ) : (
                result.statement_results.map((statement) => (
                  <article key={statement.statement_id} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className={`rounded-md border px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${classificationClass(statement.classification)}`}>
                        {statement.classification}
                      </span>
                      <span className="text-xs text-slate-400">Confidence {Math.round(statement.confidence_score * 100)}%</span>
                    </div>

                    <p className="text-sm text-slate-100">{statement.rationale}</p>

                    <p className="mt-2 text-xs text-slate-400">
                      Bill: {statement.bill_title} • Vote: {statement.vote_position ?? "unknown"}
                    </p>

                    <details className="mt-3 rounded-lg border border-white/10 bg-slate-900/60 p-3">
                      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.08em] text-civic-100">
                        View evidence
                      </summary>
                      <p className="mt-2 text-sm text-slate-200">{statement.statement_text}</p>
                      {statement.statement_source_url ? (
                        <a
                          href={statement.statement_source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs text-civic-100 underline decoration-dotted"
                        >
                          Statement source <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </details>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="panel p-5 sm:p-6">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-white">
                <ShieldCheck className="h-4 w-4 text-civic-100" /> Constituent Impact
              </h2>
              <p className={`text-sm font-semibold uppercase tracking-[0.08em] ${statusTone(result.constituent_impact.status)}`}>
                {result.constituent_impact.status} alignment
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-300">
                <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-2">Aligned: {result.constituent_impact.alignedCount}</div>
                <div className="rounded-lg border border-rose-400/25 bg-rose-500/10 p-2">Misaligned: {result.constituent_impact.misalignedCount}</div>
                <div className="rounded-lg border border-slate-400/25 bg-slate-500/10 p-2">Insufficient: {result.constituent_impact.insufficientCount}</div>
              </div>
            </article>

            <article className="panel p-5 sm:p-6">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-white">
                <TrendingUp className="h-4 w-4 text-civic-100" /> Wealth Tracker
              </h2>
              {result.wealth_tracker.trend.length < 2 ? (
                <p className="text-sm text-slate-400">Not enough disclosure history to render trend.</p>
              ) : (
                <>
                  <svg viewBox="0 0 100 100" className="h-24 w-full rounded-lg border border-white/10 bg-slate-950/70 p-2">
                    <polyline fill="none" stroke="rgb(62,163,255)" strokeWidth="2" points={sparkLine} />
                  </svg>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                    <span>Salary benchmark: {formatUsd(result.wealth_tracker.salaryBenchmarkUsd)}</span>
                    <span>
                      Latest est. net worth: {formatUsd(result.wealth_tracker.trend[result.wealth_tracker.trend.length - 1]?.netWorthEstimateUsd ?? 0)}
                    </span>
                  </div>
                </>
              )}
            </article>
          </section>

          <footer className="panel p-5 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <section>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.1em] text-civic-100">Methodology & Warnings</h3>
                <ul className="space-y-2 text-sm text-slate-300">
                  {result.methodology_notes.map((note) => (
                    <li key={note} className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2">
                      {note}
                    </li>
                  ))}
                  {result.warnings.map((warning) => (
                    <li key={warning} className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-amber-100">
                      {warning}
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.1em] text-civic-100">Grounding Sources</h3>
                <div className="space-y-3 text-sm text-slate-300">
                  {result.grounding.google_queries.map((queryResult) => (
                    <div key={queryResult.query} className="rounded-lg border border-white/10 bg-slate-950/60 p-3">
                      <p className="font-medium text-white">{queryResult.query}</p>
                      <p className="text-xs text-slate-400">{queryResult.note}</p>
                      <ul className="mt-2 space-y-1">
                        {queryResult.results.slice(0, 2).map((item) => (
                          <li key={item.link}>
                            <a href={item.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-civic-100 underline decoration-dotted">
                              {item.title || item.link} <ExternalLink className="h-3 w-3" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}

                  {result.grounding.fact_checks.length > 0 ? (
                    <div className="rounded-lg border border-white/10 bg-slate-950/60 p-3">
                      <p className="font-medium text-white">Fact check database hits</p>
                      <ul className="mt-2 space-y-1">
                        {result.grounding.fact_checks.slice(0, 3).map((fact) => (
                          <li key={`${fact.claim}-${fact.reviewUrl ?? "n"}`} className="text-xs text-slate-300">
                            {fact.claim} {fact.reviewRating ? `(${fact.reviewRating})` : ""}
                            {fact.reviewUrl ? (
                              <a href={fact.reviewUrl} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 text-civic-100 underline decoration-dotted">
                                Source <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {result.grounding.news_cross_check ? (
                    <p className="text-xs text-slate-400">
                      News cross-check: {result.grounding.news_cross_check.articleCount} related article(s) from {result.grounding.news_cross_check.sources.join(", ")}
                    </p>
                  ) : null}
                </div>
              </section>
            </div>
          </footer>
        </>
      ) : null}
      <ChatbotWidget context={{ query, topic, analysis: result }} />
    </main>
  );
}
