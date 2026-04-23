"use client";

import { BookmarkPlus, Filter, Pin, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { DetailDrawer } from "@/components/evidence/detail-drawer";
import { EvidenceCard } from "@/components/evidence/evidence-card";
import { MethodologyBlock } from "@/components/evidence/methodology-block";
import { StatusBadge } from "@/components/ui/status-badge";
import type { getDashboardData } from "@/lib/services/dashboard";

type DashboardPayload = NonNullable<Awaited<ReturnType<typeof getDashboardData>>>;
type EvidenceType = "analysis" | "statement" | "vote" | "donor" | "disclosure";

interface EvidenceItem {
  id: string;
  type: EvidenceType;
  title: string;
  summary: string;
  timestamp?: string;
  confidenceScore?: number | null;
  verificationState: "VERIFIED" | "UNVERIFIED" | "NEEDS_VERIFICATION";
  issueTags: string[];
  notes: string[];
  rawEvidence?: unknown;
  sourceReferences: Array<{ label: string; url?: string | null }>;
  relatedLinks: {
    politicianSlug?: string | null;
    statementId?: string | null;
    voteId?: string | null;
    donorId?: string | null;
    disclosureId?: string | null;
    analysisId?: string | null;
  };
}

export function InvestigationWorkbench({ data }: { data: DashboardPayload }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [officeFilter, setOfficeFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [partyFilter, setPartyFilter] = useState("all");
  const [chamberFilter, setChamberFilter] = useState("all");
  const [issueTagFilter, setIssueTagFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "30d" | "90d" | "365d">("all");
  const [sortBy, setSortBy] = useState<"score" | "donor_volume" | "recent_votes" | "disclosure_year">("score");
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);
  const [pinnedPoliticians, setPinnedPoliticians] = useState<string[]>([]);
  const [savedFlowCount, setSavedFlowCount] = useState(0);

  const issueTags = useMemo(
    () =>
      [...new Set(data.statementTimeline.flatMap((statement) => statement.issueTags))]
        .sort((a, b) => a.localeCompare(b)),
    [data.statementTimeline]
  );

  const evidenceItems = useMemo<EvidenceItem[]>(() => {
    const lineageFor = (recordId?: string | null) => (recordId ? data.lineageByRecord[recordId] ?? [] : []);
    const lineageNotesFor = (recordId?: string | null) =>
      lineageFor(recordId).map(
        (row) =>
          `${row.layer} | status=${row.extractionStatus ?? "N/A"} | confidence=${typeof row.confidenceScore === "number" ? `${Math.round(row.confidenceScore * 100)}%` : "N/A"}`
      );

    const analysisItems = data.statementVoteFeed.map((item) => ({
      id: `analysis-${item.id}`,
      type: "analysis" as const,
      title: `${item.classification.toUpperCase()} - ${item.billCode}`,
      summary: item.rationale,
      timestamp: new Date(item.statementDate).toISOString(),
      confidenceScore: item.confidenceScore,
      verificationState: item.verificationState,
      issueTags: item.issueTags,
      notes: [
        `Statement: ${item.statementText}`,
        `Vote position: ${item.votePosition ?? "unknown"}`,
        `Method version: ${item.methodVersion}`,
        ...lineageNotesFor(item.id)
      ],
      rawEvidence: lineageFor(item.id)[0]?.rawJsonSnapshot ?? item.metadata ?? null,
      sourceReferences: [
        { label: item.statementSourceLabel ?? "Statement source", url: item.statementSourceUrl },
        { label: "Bill summary", url: null }
      ],
      relatedLinks: {
        politicianSlug: data.politician.slug,
        statementId: item.statementId,
        voteId: item.voteRecordId,
        analysisId: item.id
      }
    }));

    const statementItems = data.statementTimeline.map((item) => ({
      id: `statement-${item.id}`,
      type: "statement" as const,
      title: `Statement - ${new Date(item.madeAt).toLocaleDateString("en-US")}`,
      summary: item.text,
      timestamp: new Date(item.madeAt).toISOString(),
      confidenceScore: null,
      verificationState: item.verificationState,
      issueTags: item.issueTags,
      notes: [
        `Source type: ${item.sourceType}`,
        `Linked bills: ${item.linkedBills.map((link) => link.billCode).join(", ") || "none"}`,
        ...lineageNotesFor(item.id)
      ],
      rawEvidence: lineageFor(item.id)[0]?.rawJsonSnapshot ?? null,
      sourceReferences: [{ label: item.sourceLabel ?? "Source", url: item.sourceUrl }],
      relatedLinks: {
        politicianSlug: data.politician.slug,
        statementId: item.id
      }
    }));

    const voteItems = data.voteTimeline.map((item) => ({
      id: `vote-${item.id}`,
      type: "vote" as const,
      title: `Vote - ${item.billCode}`,
      summary: `${item.votePosition} on ${item.billTitle}`,
      timestamp: new Date(item.votedAt).toISOString(),
      confidenceScore: null,
      verificationState: item.verificationState,
      issueTags: item.issueTags,
      notes: [`Roll call reference: ${item.rollCallReference ?? "not available"}`, ...lineageNotesFor(item.id)],
      rawEvidence: lineageFor(item.id)[0]?.rawJsonSnapshot ?? null,
      sourceReferences: [{ label: "Roll call evidence", url: null }],
      relatedLinks: {
        politicianSlug: data.politician.slug,
        voteId: item.id
      }
    }));

    const donorItems = data.donorRecords.map((item) => ({
      id: `donor-${item.id}`,
      type: "donor" as const,
      title: `Donor - ${item.donorName}`,
      summary: `${item.donorType} contribution of ${new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      }).format(item.amountUsd)}`,
      timestamp: new Date(item.contributionDate).toISOString(),
      confidenceScore: null,
      verificationState: item.verificationState,
      issueTags: [item.donorSector],
      notes: [
        `Election cycle: ${item.electionCycle}`,
        `Contribution type: ${item.contributionType ?? "not specified"}`,
        `Source system: ${item.sourceSystem}`,
        ...lineageNotesFor(item.id)
      ],
      rawEvidence: lineageFor(item.id)[0]?.rawJsonSnapshot ?? null,
      sourceReferences: [{ label: item.sourceSystem, url: null }],
      relatedLinks: {
        politicianSlug: data.politician.slug,
        donorId: item.id
      }
    }));

    const disclosureItems = data.disclosureHistory.map((item) => ({
      id: `disclosure-${item.id}`,
      type: "disclosure" as const,
      title: `Disclosure - ${item.filingYear}`,
      summary: `${item.reportType} filing with ${item.assets.length} assets and ${item.transactions.length} transactions`,
      timestamp: item.filedAt ? new Date(item.filedAt).toISOString() : undefined,
      confidenceScore: item.extractionConfidence,
      verificationState: item.verificationState,
      issueTags: ["financial_disclosure"],
      notes: [
        `Status: ${item.extractionStatus}`,
        `Parser: ${item.parserVersion ?? "unknown"}`,
        `Liabilities: ${item.liabilities.length}`,
        ...lineageNotesFor(item.id)
      ],
      rawEvidence: lineageFor(item.id)[0]?.rawJsonSnapshot ?? null,
      sourceReferences: [
        { label: "Disclosure source", url: item.sourceUrl },
        { label: "Raw PDF path", url: item.rawPdfPath ?? null }
      ],
      relatedLinks: {
        politicianSlug: data.politician.slug,
        disclosureId: item.id
      }
    }));

    return [...analysisItems, ...statementItems, ...voteItems, ...donorItems, ...disclosureItems];
  }, [data]);

  const filteredEvidence = useMemo(() => {
    const now = Date.now();

    const matchesTimeFilter = (timestamp?: string) => {
      if (timeFilter === "all" || !timestamp) {
        return true;
      }
      const ageMs = now - new Date(timestamp).getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      const maxAgeMs = timeFilter === "30d" ? 30 * dayMs : timeFilter === "90d" ? 90 * dayMs : 365 * dayMs;
      return ageMs <= maxAgeMs;
    };

    const matchesPoliticianMeta =
      (officeFilter === "all" || data.politician.officeTitle === officeFilter) &&
      (stateFilter === "all" || (data.politician.jurisdictionState ?? "") === stateFilter) &&
      (partyFilter === "all" || (data.politician.party ?? "") === partyFilter) &&
      (chamberFilter === "all" || (data.politician.chamber ?? "") === chamberFilter);

    if (!matchesPoliticianMeta) {
      return [] as EvidenceItem[];
    }

    const searched = evidenceItems.filter((item) => {
      const haystack = `${item.title} ${item.summary} ${item.notes.join(" ")}`.toLowerCase();
      return (
        haystack.includes(searchTerm.toLowerCase()) &&
        (issueTagFilter === "all" || item.issueTags.includes(issueTagFilter)) &&
        matchesTimeFilter(item.timestamp)
      );
    });

    const sorted = [...searched];
    if (sortBy === "recent_votes") {
      sorted.sort((a, b) => (b.timestamp ? new Date(b.timestamp).getTime() : 0) - (a.timestamp ? new Date(a.timestamp).getTime() : 0));
    } else if (sortBy === "donor_volume") {
      sorted.sort((a, b) => (b.type === "donor" ? 1 : 0) - (a.type === "donor" ? 1 : 0));
    } else if (sortBy === "disclosure_year") {
      sorted.sort((a, b) => (b.type === "disclosure" ? 1 : 0) - (a.type === "disclosure" ? 1 : 0));
    } else {
      sorted.sort((a, b) => (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0));
    }

    return sorted;
  }, [
    chamberFilter,
    data.politician.chamber,
    data.politician.jurisdictionState,
    data.politician.officeTitle,
    data.politician.party,
    evidenceItems,
    issueTagFilter,
    officeFilter,
    partyFilter,
    searchTerm,
    sortBy,
    stateFilter,
    timeFilter
  ]);

  const pinnedCards = useMemo(
    () => data.politicianDirectory.filter((politician) => pinnedPoliticians.includes(politician.slug)),
    [data.politicianDirectory, pinnedPoliticians]
  );

  return (
    <div className="space-y-6">
      <section className="panel p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Investigative Research Workspace</h2>
          <button
            type="button"
            onClick={() => setSavedFlowCount((count) => count + 1)}
            className="inline-flex items-center gap-2 rounded-md border border-civic-300/30 bg-civic-700/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-civic-100 hover:bg-civic-700/35"
            title="Saved investigation flow scaffold (future persistence extension)"
          >
            <BookmarkPlus className="h-4 w-4" /> Save Investigation Flow ({savedFlowCount})
          </button>
        </div>

        <div className="grid gap-3 lg:grid-cols-12">
          <label className="lg:col-span-4 flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search records, evidence notes, or sources"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </label>

          <select value={issueTagFilter} onChange={(event) => setIssueTagFilter(event.target.value)} className="lg:col-span-2 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            <option value="all">All issue tags</option>
            {issueTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>

          <select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value as "all" | "30d" | "90d" | "365d")} className="lg:col-span-2 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            <option value="all">All time</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="365d">Last year</option>
          </select>

          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as "score" | "donor_volume" | "recent_votes" | "disclosure_year")} className="lg:col-span-2 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            <option value="score">Sort: confidence</option>
            <option value="donor_volume">Sort: donor volume</option>
            <option value="recent_votes">Sort: recent votes</option>
            <option value="disclosure_year">Sort: disclosure year</option>
          </select>

          <div className="lg:col-span-2 flex items-center justify-center rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
            <Filter className="mr-2 h-4 w-4" /> {filteredEvidence.length} records
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select value={officeFilter} onChange={(event) => setOfficeFilter(event.target.value)} className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            <option value="all">Office: all</option>
            <option value={data.politician.officeTitle}>{data.politician.officeTitle}</option>
          </select>
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            <option value="all">State: all</option>
            <option value={data.politician.jurisdictionState ?? ""}>{data.politician.jurisdictionState ?? "N/A"}</option>
          </select>
          <select value={partyFilter} onChange={(event) => setPartyFilter(event.target.value)} className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            <option value="all">Party: all</option>
            <option value={data.politician.party ?? ""}>{data.politician.party ?? "N/A"}</option>
          </select>
          <select value={chamberFilter} onChange={(event) => setChamberFilter(event.target.value)} className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            <option value="all">Chamber: all</option>
            <option value={data.politician.chamber ?? ""}>{data.politician.chamber ?? "N/A"}</option>
          </select>
        </div>
      </section>

      <section className="panel p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-civic-100">Pinned Comparisons</h3>
          <button
            type="button"
            onClick={() =>
              setPinnedPoliticians((existing) =>
                existing.includes(data.politician.slug) ? existing : [...existing, data.politician.slug]
              )
            }
            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-slate-900/70 px-2 py-1 text-xs text-slate-100 hover:border-civic-300/40"
          >
            <Pin className="h-3.5 w-3.5" /> Pin current politician
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pinnedCards.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-300">No pinned comparisons yet.</p>
          ) : (
            pinnedCards.map((politician) => (
              <article key={politician.id} className="rounded-lg border border-white/10 bg-slate-950/70 p-3">
                <p className="text-sm font-semibold text-white">{politician.fullName}</p>
                <p className="text-xs text-slate-300">{politician.officeTitle}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <StatusBadge label={politician.party ?? "N/A"} tone="neutral" />
                  <StatusBadge label={politician.jurisdictionState ?? "N/A"} tone="neutral" />
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="panel p-5 sm:p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-civic-100">Evidence Feed</h3>
            <div className="space-y-3">
              {filteredEvidence.length === 0 ? (
                <p className="rounded-lg border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-300">
                  No evidence records match current filters. Adjust search/filter constraints.
                </p>
              ) : (
                filteredEvidence.map((item) => (
                  <div key={item.id} className="space-y-2">
                    <EvidenceCard
                      title={item.title}
                      summary={item.summary}
                      timestamp={item.timestamp}
                      confidence={item.confidenceScore}
                      onInspect={() => setSelectedEvidence(item)}
                    />
                    <div className="flex justify-end">
                      <StatusBadge
                        label={
                          item.verificationState === "VERIFIED"
                            ? "verified"
                            : item.verificationState === "NEEDS_VERIFICATION"
                              ? "needs verification"
                              : "parsed only"
                        }
                        tone={
                          item.verificationState === "VERIFIED"
                            ? "positive"
                            : item.verificationState === "NEEDS_VERIFICATION"
                              ? "warning"
                              : "neutral"
                        }
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <DashboardView data={data} />
        </div>

        <div className="space-y-4">
          <section className="panel p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-civic-100">Methodology Inspector</h3>
            <MethodologyBlock
              title="Honesty Score Calculation"
              formula={data.methodology.honesty_score_formula}
              notes={data.methodology.notes}
            />
          </section>

          <section className="panel p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-civic-100">Data Completeness</h3>
            <div className="space-y-2 text-xs text-slate-200">
              <p className="rounded-md border border-white/10 bg-slate-900/70 p-2">
                Statements tracked: {data.statementTimeline.length}
              </p>
              <p className="rounded-md border border-white/10 bg-slate-900/70 p-2">Votes tracked: {data.voteTimeline.length}</p>
              <p className="rounded-md border border-white/10 bg-slate-900/70 p-2">Donor records: {data.donorRecords.length}</p>
              <p className="rounded-md border border-white/10 bg-slate-900/70 p-2">Disclosures: {data.disclosureHistory.length}</p>
              <p className="rounded-md border border-white/10 bg-slate-900/70 p-2">Lineage entries: {data.trustSignals.lineageCount}</p>
            </div>
          </section>
        </div>
      </section>

      <DetailDrawer
        open={Boolean(selectedEvidence)}
        title={selectedEvidence?.title ?? ""}
        summary={selectedEvidence?.summary ?? ""}
        confidenceScore={selectedEvidence?.confidenceScore}
        notes={selectedEvidence?.notes ?? []}
        rawEvidence={selectedEvidence?.rawEvidence}
        sourceReferences={selectedEvidence?.sourceReferences ?? []}
        relatedLinks={selectedEvidence?.relatedLinks}
        onClose={() => setSelectedEvidence(null)}
      />
    </div>
  );
}
