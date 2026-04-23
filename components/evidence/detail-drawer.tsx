"use client";

import { ExternalLink, X } from "lucide-react";

import { ConfidenceBadge } from "@/components/evidence/confidence-badge";
import { RelatedRecordsPanel } from "@/components/evidence/related-records-panel";

interface SourceReference {
  label: string;
  url?: string | null;
}

interface DetailDrawerProps {
  open: boolean;
  title: string;
  summary: string;
  confidenceScore?: number | null;
  notes?: string[];
  rawEvidence?: unknown;
  sourceReferences?: SourceReference[];
  relatedLinks?: {
    politicianSlug?: string | null;
    statementId?: string | null;
    voteId?: string | null;
    donorId?: string | null;
    disclosureId?: string | null;
    analysisId?: string | null;
  };
  onClose: () => void;
}

export function DetailDrawer({
  open,
  title,
  summary,
  confidenceScore,
  notes = [],
  rawEvidence,
  sourceReferences = [],
  relatedLinks = {},
  onClose
}: DetailDrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-slate-950 p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="panel-title mb-1">Evidence Detail</p>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/15 bg-slate-800/60 p-1.5 text-slate-200 hover:bg-slate-700/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Summary</p>
            <p className="mt-2 text-sm text-slate-100">{summary}</p>
            <div className="mt-3">
              <ConfidenceBadge score={confidenceScore} />
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Source References</p>
            <div className="mt-2 space-y-2">
              {sourceReferences.length === 0 ? (
                <p className="text-xs text-slate-400">No source links available</p>
              ) : (
                sourceReferences.map((source) => (
                  <div key={`${source.label}-${source.url ?? "none"}`} className="rounded-lg border border-white/10 bg-slate-950/80 p-2">
                    <p className="text-xs text-slate-200">{source.label}</p>
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-civic-200 hover:text-civic-100"
                      >
                        Open source <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Evidence Trail</p>
            <div className="mt-2 space-y-2">
              {notes.length === 0 ? (
                <p className="text-xs text-slate-400">No additional evidence notes</p>
              ) : (
                notes.map((note) => (
                  <p key={note} className="rounded-lg border border-white/10 bg-slate-950/80 p-2 text-xs text-slate-200">
                    {note}
                  </p>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Raw Evidence Snapshot</p>
            {rawEvidence ? (
              <details className="mt-2 rounded-lg border border-white/10 bg-slate-950/80 p-2">
                <summary className="cursor-pointer text-xs text-civic-100">Expand raw data</summary>
                <pre className="mt-2 overflow-auto text-[11px] text-slate-200">
                  {JSON.stringify(rawEvidence, null, 2)}
                </pre>
              </details>
            ) : (
              <p className="mt-2 text-xs text-slate-400">No raw snapshot stored for this record.</p>
            )}
          </section>

          <section className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Related Records</p>
            <div className="mt-2">
              <RelatedRecordsPanel links={relatedLinks} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
