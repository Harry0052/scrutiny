import { FileSearch } from "lucide-react";

import { ConfidenceBadge } from "@/components/evidence/confidence-badge";

export function EvidenceCard({
  title,
  summary,
  timestamp,
  confidence,
  onInspect
}: {
  title: string;
  summary: string;
  timestamp?: string;
  confidence?: number | null;
  onInspect?: () => void;
}) {
  return (
    <article className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">{title}</p>
        <ConfidenceBadge score={confidence} />
      </div>
      <p className="text-sm text-slate-200">{summary}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400">{timestamp ? new Date(timestamp).toLocaleString("en-US") : "No timestamp"}</p>
        {onInspect ? (
          <button
            type="button"
            onClick={onInspect}
            className="inline-flex items-center gap-1 rounded-md border border-civic-300/30 bg-civic-700/20 px-2 py-1 text-xs text-civic-100 hover:bg-civic-700/35"
          >
            <FileSearch className="h-3.5 w-3.5" /> Inspect
          </button>
        ) : null}
      </div>
    </article>
  );
}
