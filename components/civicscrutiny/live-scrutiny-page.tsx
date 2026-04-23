"use client";

import { AlertTriangle, CalendarDays, ExternalLink, RefreshCcw, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import type {
  AnalysisModule,
  AnalysisModuleState,
  ConfidenceLabel,
  LiveAnalysisReport,
  LiveAnalysisStreamEvent,
  QuoteEvidence,
  QuoteRelation,
  SourceType,
} from "@/lib/scrutiny/statement-types";

const MODULES: AnalysisModule[] = ["identity", "sources", "statements", "actions", "analysis", "verdict"];

function moduleTitle(module: AnalysisModule): string {
  if (module === "identity") return "Profile Resolution";
  if (module === "sources") return "Source Retrieval";
  if (module === "statements") return "Quote Extraction";
  if (module === "actions") return "Action Retrieval";
  if (module === "analysis") return "Comparison Analysis";
  return "Final Scoring";
}

function moduleStateClass(state: AnalysisModuleState): string {
  if (state === "done") return "border-emerald-400/35 bg-emerald-500/10 text-emerald-100";
  if (state === "loading") return "border-civic-400/35 bg-civic-700/20 text-civic-100";
  if (state === "error") return "border-rose-400/35 bg-rose-500/10 text-rose-100";
  return "border-white/15 bg-slate-900/60 text-slate-300";
}

function moduleStateLabel(state: AnalysisModuleState): string {
  if (state === "loading") return "Analyzing";
  if (state === "done") return "Done";
  if (state === "error") return "Error";
  return "Idle";
}

function scoreBandLabel(band: LiveAnalysisReport["analysis"]["scoreBand"]): string {
  if (band === "highly_misleading") return "0-20: highly misleading";
  if (band === "questionable") return "20-40: questionable";
  if (band === "mixed_reliability") return "40-60: mixed reliability";
  if (band === "mostly_consistent") return "60-80: mostly consistent";
  return "80-100: highly consistent";
}

function confidenceBadgeClass(confidence: ConfidenceLabel): string {
  if (confidence === "High") return "border-emerald-400/40 bg-emerald-500/15 text-emerald-100";
  if (confidence === "Medium") return "border-amber-400/40 bg-amber-500/15 text-amber-100";
  return "border-rose-400/40 bg-rose-500/15 text-rose-100";
}

function relationBadgeClass(relation?: QuoteRelation): string {
  if (relation === "supports") return "border-emerald-400/40 bg-emerald-500/15 text-emerald-100";
  if (relation === "contradicts") return "border-rose-400/40 bg-rose-500/15 text-rose-100";
  if (relation === "partially_conflicts") return "border-amber-400/40 bg-amber-500/15 text-amber-100";
  return "border-white/20 bg-slate-900/70 text-slate-200";
}

function sourceTypeLabel(sourceType: SourceType): string {
  if (sourceType === "press_release") return "Press Release";
  if (sourceType === "official_bio") return "Official Bio";
  if (sourceType === "campaign_site") return "Campaign Site";
  if (sourceType === "directory") return "Directory";
  return sourceType.charAt(0).toUpperCase() + sourceType.slice(1);
}

function QuoteCard({ quote, showRelation = true }: { quote: QuoteEvidence; showRelation?: boolean }) {
  return (
    <article className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
      <p className="text-base leading-7 text-white sm:text-lg">“{quote.quote}”</p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
        <span className="rounded-md border border-white/15 bg-slate-900/70 px-2 py-1">{quote.speaker}</span>
        {quote.date ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-slate-900/70 px-2 py-1">
            <CalendarDays className="h-3 w-3" /> {new Date(quote.date).toLocaleDateString()}
          </span>
        ) : null}
        <span className="rounded-md border border-white/15 bg-slate-900/70 px-2 py-1">{sourceTypeLabel(quote.sourceType)}</span>
        <span className="rounded-md border border-white/15 bg-slate-900/70 px-2 py-1">Tier {quote.reliabilityTier}</span>
        {showRelation && quote.relation ? (
          <span className={`rounded-md border px-2 py-1 font-semibold ${relationBadgeClass(quote.relation)}`}>
            {quote.relation.replace("_", " ")}
          </span>
        ) : null}
      </div>

      <div className="mt-2 text-xs text-slate-400">
        <span>{quote.sourceName}</span>
        {quote.sourceUrl ? (
          <a href={quote.sourceUrl} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-civic-100 underline decoration-dotted">
            Source <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      {quote.rationale ? <p className="mt-2 text-xs text-slate-400">{quote.rationale}</p> : null}
    </article>
  );
}

export function LiveScrutinyPage() {
  const [politicianQuery, setPoliticianQuery] = useState("");
  const [topic, setTopic] = useState("");
  const [statementText, setStatementText] = useState("");
  const [running, setRunning] = useState(false);
  const [refreshingStatement, setRefreshingStatement] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<LiveAnalysisReport | null>(null);

  const [moduleStates, setModuleStates] = useState<Record<AnalysisModule, AnalysisModuleState>>({
    identity: "idle",
    sources: "idle",
    statements: "idle",
    actions: "idle",
    analysis: "idle",
    verdict: "idle",
  });

  const scoreAngle = useMemo(() => {
    const score = report?.analysis.scrutiny.finalScore ?? 0;
    return Math.max(0, Math.min(100, score)) * 3.6;
  }, [report?.analysis.scrutiny.finalScore]);

  const resetModules = () => {
    setModuleStates({
      identity: "idle",
      sources: "idle",
      statements: "idle",
      actions: "idle",
      analysis: "idle",
      verdict: "idle",
    });
  };

  const analyze = async () => {
    const query = politicianQuery.trim();
    if (!query || running) {
      return;
    }

    setRunning(true);
    setError(null);
    setReport(null);
    resetModules();

    try {
      const params = new URLSearchParams({ q: query });
      if (topic.trim()) {
        params.set("topic", topic.trim());
      }
      if (statementText.trim()) {
        params.set("statement", statementText.trim());
      }

      const response = await fetch(`/api/scrutiny/stream?${params.toString()}`, { cache: "no-store" });
      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `Request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) {
            continue;
          }

          const event = JSON.parse(line) as LiveAnalysisStreamEvent;
          if (event.type === "module" && event.module && event.state) {
            setModuleStates((prev) => ({ ...prev, [event.module as AnalysisModule]: event.state as AnalysisModuleState }));
          }
          if (event.type === "final" && event.data) {
            setReport(event.data as LiveAnalysisReport);
          }
          if (event.type === "error") {
            setError(event.message ?? "Analysis failed");
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setRunning(false);
    }
  };

  const refreshStatement = async () => {
    const query = politicianQuery.trim();
    if (!query || refreshingStatement) {
      return;
    }

    setRefreshingStatement(true);
    setError(null);

    try {
      const params = new URLSearchParams({ q: query });
      if (topic.trim()) {
        params.set("topic", topic.trim());
      }

      const response = await fetch(`/api/scrutiny/random-statement?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as {
        statement?: { quote?: string; text?: string } | null;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || `Refresh failed (${response.status})`);
      }

      const quote = payload.statement?.quote ?? payload.statement?.text;
      if (quote) {
        setStatementText(quote);
      } else {
        setError("No direct quote was found for this query. Try a different politician or topic.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh statement.");
    } finally {
      setRefreshingStatement(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <section className="panel p-5 sm:p-6">
        <p className="panel-title mb-1">CivicWatch</p>
        <h1 className="text-2xl font-semibold text-white">Transparent Political Quote Analysis</h1>
        <p className="mt-2 max-w-4xl text-sm text-slate-300">
          Live, stateless analysis built from direct quotes and source-ranked evidence. No persistent politician database is used for this report.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_240px_130px]">
          <input
            value={politicianQuery}
            onChange={(event) => setPoliticianQuery(event.target.value)}
            placeholder="Search politician (e.g., Kamala Harris, Gavin Newsom, Karen Bass)"
            className="rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
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
              void analyze();
            }}
            disabled={!politicianQuery.trim() || running}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-civic-300/35 bg-civic-700/25 px-3 py-2.5 text-sm font-semibold text-civic-100 transition hover:bg-civic-700/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Search className="h-4 w-4" /> Analyze
          </button>
        </div>
      </section>

      <section className="panel p-5 sm:p-6">
        <label htmlFor="statement-box" className="mb-2 block text-sm font-semibold text-white">
          Statement Being Analyzed
        </label>
        <textarea
          id="statement-box"
          value={statementText}
          onChange={(event) => setStatementText(event.target.value)}
          placeholder="Paste a quote or click Refresh Statement to pull a direct quote."
          rows={6}
          className="w-full rounded-xl border border-white/15 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void analyze();
            }}
            disabled={!politicianQuery.trim() || running}
            className="inline-flex items-center gap-2 rounded-lg border border-civic-300/35 bg-civic-700/25 px-4 py-2 text-sm font-semibold text-civic-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? "Analyzing..." : "Analyze Statement"}
          </button>

          <button
            type="button"
            onClick={() => {
              void refreshStatement();
            }}
            disabled={!politicianQuery.trim() || refreshingStatement}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw className={`h-4 w-4 ${refreshingStatement ? "animate-spin" : ""}`} /> Refresh Statement
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((module) => (
          <article key={module} className={`rounded-xl border px-3 py-3 text-xs ${moduleStateClass(moduleStates[module])}`}>
            <p className="font-semibold uppercase tracking-[0.08em]">{moduleTitle(module)}</p>
            <p className="mt-1 text-[11px]">{moduleStateLabel(moduleStates[module])}</p>
          </article>
        ))}
      </section>

      {error ? (
        <section className="panel border-rose-400/30 bg-rose-700/15 p-5 text-sm text-rose-100">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        </section>
      ) : null}

      {report ? (
        <>
          <section className="panel p-5 sm:p-6">
            <p className="panel-title mb-2">A. Politician Profile</p>
            <h2 className="text-2xl font-semibold text-white">{report.profile.name}</h2>
            <p className="mt-1 text-base text-slate-200">{report.profile.currentTitle}</p>
            <p className="mt-1 text-sm text-slate-300">Role: {report.profile.currentRole}</p>
            {report.profile.party ? <p className="mt-1 text-sm text-slate-300">Party: {report.profile.party}</p> : null}
            {report.profile.politicalCareerStart ? (
              <p className="mt-1 text-sm text-slate-300">Political career start: {report.profile.politicalCareerStart}</p>
            ) : (
              <p className="mt-1 text-sm text-slate-400">Political career start: unavailable from current live sources.</p>
            )}
            <p className="mt-3 text-sm leading-6 text-slate-200">{report.profile.summary}</p>
          </section>

          <section className="panel p-5 sm:p-6">
            <p className="panel-title mb-3">B. Statement Being Analyzed</p>
            <QuoteCard quote={report.analysis.statementCard} showRelation={false} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="panel p-5 sm:p-6">
              <p className="panel-title mb-2">C. Scrutiny Score</p>
              <div className="mb-4 flex flex-wrap items-center gap-5">
                <div
                  className="relative h-28 w-28 rounded-full"
                  style={{
                    background: `conic-gradient(#3ee37d ${scoreAngle}deg, rgba(148,163,184,0.2) ${scoreAngle}deg 360deg)`,
                  }}
                >
                  <div className="absolute inset-[10px] flex items-center justify-center rounded-full bg-slate-950 text-lg font-semibold text-white">
                    {report.analysis.scrutiny.finalScore.toFixed(1)}
                  </div>
                </div>

                <div>
                  <p className="text-lg font-semibold text-white">Final Scrutiny Score: {report.analysis.scrutiny.finalScore.toFixed(1)} / 100</p>
                  <p className="text-sm text-slate-300">{scoreBandLabel(report.analysis.scoreBand)}</p>
                  <span className={`mt-2 inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${confidenceBadgeClass(report.analysis.scrutiny.confidence)}`}>
                    Analysis Confidence: {report.analysis.scrutiny.confidence}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-sm text-slate-200">
                <div className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2">
                  Consistency: {report.analysis.scrutiny.breakdown.consistencyScore.toFixed(1)}
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2">
                  Fact Alignment: {report.analysis.scrutiny.breakdown.factAlignmentScore.toFixed(1)}
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2">
                  Source Reliability: {report.analysis.scrutiny.breakdown.sourceReliabilityScore.toFixed(1)}
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2">
                  Context Completeness: {report.analysis.scrutiny.breakdown.contextCompletenessScore.toFixed(1)}
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2">
                  Rhetoric Neutrality: {report.analysis.scrutiny.breakdown.rhetoricScore.toFixed(1)}
                </div>
              </div>
            </article>

            <article className="panel p-5 sm:p-6">
              <p className="panel-title mb-2">Evidence Stats</p>
              <div className="space-y-2 text-sm text-slate-200">
                <div className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2">
                  Compared quotes: {report.analysis.scrutiny.evidenceStats.comparedQuotes}
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2">
                  Supporting quotes: {report.analysis.scrutiny.evidenceStats.supportingQuotes}
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2">
                  Conflicting quotes: {report.analysis.scrutiny.evidenceStats.contradictoryQuotes}
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2">
                  Tier 1-2 quotes: {report.analysis.scrutiny.evidenceStats.strongSourceQuotes}
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2">
                  Unique sources: {report.analysis.scrutiny.evidenceStats.sourcesUsed}
                </div>
              </div>
            </article>
          </section>

          <section className="panel p-5 sm:p-6">
            <p className="panel-title mb-3">D. Statements Compared</p>
            {report.analysis.statementsCompared.length === 0 ? (
              <p className="text-sm text-slate-400">No usable direct quote comparisons were found in this run.</p>
            ) : (
              <div className="space-y-3">
                {report.analysis.statementsCompared.map((quote) => (
                  <QuoteCard key={quote.id} quote={quote} />
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="panel p-5 sm:p-6">
              <p className="panel-title mb-3">E. Supporting Evidence</p>
              {report.analysis.supportingEvidence.length === 0 ? (
                <p className="text-sm text-slate-400">No direct supporting quote set met the comparison threshold.</p>
              ) : (
                <div className="space-y-3">
                  {report.analysis.supportingEvidence.map((quote) => (
                    <QuoteCard key={quote.id} quote={quote} />
                  ))}
                </div>
              )}
            </article>

            <article className="panel p-5 sm:p-6">
              <p className="panel-title mb-3">F. Contradictory Statements</p>
              {report.analysis.contradictoryEvidence.length === 0 ? (
                <p className="text-sm text-slate-400">No high-confidence contradiction pattern was identified.</p>
              ) : (
                <div className="space-y-3">
                  {report.analysis.contradictoryEvidence.map((quote) => (
                    <QuoteCard key={quote.id} quote={quote} />
                  ))}
                </div>
              )}
            </article>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="panel p-5 sm:p-6">
              <p className="panel-title mb-2">G. Why This Score?</p>
              <p className="text-sm leading-6 text-slate-200">{report.analysis.scrutiny.explanation}</p>

              <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-300">
                Weighted model: consistency ({Math.round(report.analysis.scrutiny.breakdown.weights.consistency * 100)}%), fact alignment ({Math.round(report.analysis.scrutiny.breakdown.weights.factAlignment * 100)}%), source reliability ({Math.round(report.analysis.scrutiny.breakdown.weights.sourceReliability * 100)}%), context completeness ({Math.round(report.analysis.scrutiny.breakdown.weights.contextCompleteness * 100)}%), rhetoric neutrality ({Math.round(report.analysis.scrutiny.breakdown.weights.rhetoric * 100)}%).
              </div>
            </article>

            <article className="panel p-5 sm:p-6">
              <p className="panel-title mb-2">H. Limitations</p>
              {report.analysis.scrutiny.limitations.length === 0 ? (
                <p className="text-sm text-slate-300">No major extraction limitations were detected for this run.</p>
              ) : (
                <ul className="space-y-2 text-sm text-slate-200">
                  {report.analysis.scrutiny.limitations.map((item, index) => (
                    <li key={`${index}-${item.slice(0, 18)}`} className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>

          <section className="panel p-5 sm:p-6">
            <p className="panel-title mb-3">I. Sources</p>
            {report.analysis.sources.length === 0 ? (
              <p className="text-sm text-slate-400">No source links were retained for this run.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {report.analysis.sources.map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-civic-100 underline decoration-dotted"
                  >
                    <span>{source.label}</span>
                    <ExternalLink className="h-4 w-4 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="panel p-5 sm:p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-civic-100">
              <ShieldCheck className="h-4 w-4" /> Methodology Notes
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {report.methodology.map((note, index) => (
                <li key={`${index}-${note.slice(0, 20)}`} className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2">
                  {note}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </main>
  );
}
