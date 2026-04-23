import Link from "next/link";
import type { Route } from "next";

interface RelatedLinks {
  politicianSlug?: string | null;
  statementId?: string | null;
  voteId?: string | null;
  donorId?: string | null;
  disclosureId?: string | null;
  analysisId?: string | null;
}

export function RelatedRecordsPanel({ links }: { links: RelatedLinks }) {
  const items = [
    links.politicianSlug ? { href: `/dashboard/politicians/${links.politicianSlug}`, label: "Politician profile" } : null,
    links.statementId ? { href: `/dashboard/statements/${links.statementId}`, label: "Statement record" } : null,
    links.voteId ? { href: `/dashboard/votes/${links.voteId}`, label: "Vote record" } : null,
    links.donorId ? { href: `/dashboard/donors/${links.donorId}`, label: "Donor record" } : null,
    links.disclosureId ? { href: `/dashboard/disclosures/${links.disclosureId}`, label: "Disclosure record" } : null,
    links.analysisId ? { href: `/dashboard/analysis/${links.analysisId}`, label: "Analysis record" } : null
  ].filter(Boolean) as Array<{ href: string; label: string }>;

  if (items.length === 0) {
    return <p className="text-xs text-slate-400">No related records</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={`${item.href}-${item.label}`}
          href={item.href as Route}
          className="rounded-md border border-civic-300/30 bg-civic-700/20 px-2 py-1 text-xs text-civic-100 hover:bg-civic-700/35"
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
