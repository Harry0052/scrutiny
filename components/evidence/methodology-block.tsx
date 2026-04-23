"use client";

import { ChevronDown, Sigma } from "lucide-react";
import { useState } from "react";

export function MethodologyBlock({
  title,
  formula,
  notes
}: {
  title: string;
  formula: string;
  notes: string[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <Sigma className="h-4 w-4 text-civic-200" />
          {title}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-300 transition ${expanded ? "rotate-180" : "rotate-0"}`} />
      </button>
      {expanded ? (
        <div className="mt-3 space-y-3">
          <p className="rounded-lg border border-white/10 bg-slate-900/80 p-2 font-mono text-xs text-civic-100">{formula}</p>
          <ul className="space-y-2 text-xs text-slate-200">
            {notes.map((note) => (
              <li key={note} className="rounded-lg border border-white/10 bg-slate-900/70 p-2">
                {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
