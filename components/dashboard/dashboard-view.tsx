import {
  Activity,
  BadgeCheck,
  Building2,
  CircleDollarSign,
  FileChartColumn,
  FlaskConical,
  Landmark,
  Scale,
  ShieldCheck
} from "lucide-react";

import type { getDashboardData } from "@/lib/services/dashboard";
import { cn } from "@/lib/utils";

type DashboardPayload = NonNullable<Awaited<ReturnType<typeof getDashboardData>>>;

function scoreTone(score: number): string {
  if (score >= 70) {
    return "text-emerald-300";
  }

  if (score >= 40) {
    return "text-amber-300";
  }

  return "text-rose-300";
}

function classificationTone(classification: "aligned" | "contradicted" | "unclear"): string {
  if (classification === "aligned") {
    return "bg-emerald-400/20 text-emerald-200 border border-emerald-300/30";
  }
  if (classification === "contradicted") {
    return "bg-rose-400/20 text-rose-100 border border-rose-300/30";
  }
  return "bg-amber-400/20 text-amber-100 border border-amber-300/30";
}

function currency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function DashboardView({ data }: { data: DashboardPayload }) {
  const mainStats = [
    {
      label: "Honesty Score",
      value: `${data.summary.honestyScore.toFixed(2)}%`,
      icon: BadgeCheck,
      tone: scoreTone(data.summary.honestyScore)
    },
    {
      label: "Comparable Statements",
      value: `${data.summary.totalComparableStatements}`,
      icon: Scale,
      tone: "text-civic-200"
    },
    {
      label: "Consistent Actions",
      value: `${data.summary.consistentActions}`,
      icon: Activity,
      tone: "text-emerald-200"
    },
    {
      label: "Donor Sectors",
      value: `${data.donorSummary.length}`,
      icon: CircleDollarSign,
      tone: "text-civic-200"
    }
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="panel mb-8 overflow-hidden">
        <div className="bg-gradient-to-r from-civic-800/80 via-civic-700/50 to-slate-900/80 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="panel-title mb-2 flex items-center gap-2 text-civic-100">
                <Landmark className="h-4 w-4" />
                CivicWatch MVP Dashboard
              </p>
              <h1 className="text-3xl font-semibold text-white">{data.politician.fullName}</h1>
              <p className="mt-1 text-sm text-civic-100/80">
                {data.politician.officeTitle} | {data.politician.jurisdictionLevel}
                {data.politician.jurisdictionState ? ` (${data.politician.jurisdictionState})` : ""}
              </p>
            </div>
            <div className="rounded-xl border border-civic-300/30 bg-slate-950/50 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.14em] text-civic-100">District</p>
              <p className="mt-1 font-medium text-white">
                {data.politician.district?.name ?? data.politician.districtLabel ?? "Unassigned"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {mainStats.map((stat) => (
            <article key={stat.label} className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
              <p className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-slate-400">
                <stat.icon className="h-4 w-4" />
                {stat.label}
              </p>
              <p className={cn("mt-2 text-2xl font-semibold", stat.tone)}>{stat.value}</p>
            </article>
          ))}
        </div>
      </header>

      <section className="mb-6 grid gap-6 lg:grid-cols-2">
        <article className="panel p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <FileChartColumn className="h-5 w-5 text-civic-200" />
            Statements Timeline
          </h2>
          <div className="space-y-4">
            {data.statementTimeline.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white">{new Date(entry.madeAt).toLocaleDateString("en-US")}</p>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{entry.sourceType}</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-200">{entry.text}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {entry.issueTags.map((tag) => (
                    <span key={`${entry.id}-${tag}`} className="rounded-full bg-civic-600/25 px-2 py-1 text-xs text-civic-100">
                      #{tag}
                    </span>
                  ))}
                  {entry.linkedBills.map((billLink) => (
                    <span key={`${entry.id}-${billLink.billId}`} className="rounded-full bg-slate-700/70 px-2 py-1 text-xs text-slate-100">
                      {billLink.billCode}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <Scale className="h-5 w-5 text-civic-200" />
            Statement vs Vote Feed
          </h2>
          <div className="space-y-4">
            {data.statementVoteFeed.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", classificationTone(item.classification))}>
                    {item.classification}
                  </span>
                  <span className="text-xs text-slate-400">confidence {Math.round(item.confidenceScore * 100)}%</span>
                </div>
                <p className="text-sm font-medium text-white">{item.billCode}</p>
                <p className="mt-1 text-xs text-slate-300">{item.billTitle}</p>
                <p className="mt-2 text-sm text-slate-200">{item.statementText}</p>
                <p className="mt-2 text-xs text-slate-400">
                  Vote signal: <span className="font-semibold text-slate-200">{item.voteSignal}</span>
                </p>
                <p className="mt-2 text-xs text-slate-400">{item.rationale}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mb-6 grid gap-6 lg:grid-cols-2">
        <article className="panel p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <Building2 className="h-5 w-5 text-civic-200" />
            Donor Influence Summary
          </h2>
          <div className="space-y-3">
            {data.donorSummary.map((donor) => (
              <div key={donor.sector} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm capitalize text-white">{donor.sector.replaceAll("_", " ")}</p>
                  <p className="text-sm font-medium text-civic-100">{currency(donor.amountUsd)}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <ShieldCheck className="h-5 w-5 text-civic-200" />
            Wealth Tracker Summary
          </h2>
          {!data.wealthSummary ? (
            <p className="text-sm text-slate-300">No disclosure file parsed yet.</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Filing {data.wealthSummary.filingYear}</p>
                <p className="mt-1 text-sm text-white">{data.wealthSummary.reportType}</p>
                <p className="mt-2 text-xs text-slate-300">
                  Extraction status: {data.wealthSummary.extractionStatus}
                  {typeof data.wealthSummary.extractionConfidence === "number"
                    ? ` (${Math.round(data.wealthSummary.extractionConfidence * 100)}% confidence)`
                    : ""}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-center">
                  <p className="text-xs text-slate-400">Assets</p>
                  <p className="mt-1 text-xl font-semibold text-white">{data.wealthSummary.assets.length}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-center">
                  <p className="text-xs text-slate-400">Liabilities</p>
                  <p className="mt-1 text-xl font-semibold text-white">{data.wealthSummary.liabilities.length}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-center">
                  <p className="text-xs text-slate-400">Income Sources</p>
                  <p className="mt-1 text-xl font-semibold text-white">{data.wealthSummary.incomeSources.length}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-center">
                  <p className="text-xs text-slate-400">Transactions</p>
                  <p className="mt-1 text-xl font-semibold text-white">{data.wealthSummary.transactions.length}</p>
                </div>
              </div>
            </div>
          )}
        </article>
      </section>

      <section className="mb-6 grid gap-6 lg:grid-cols-2">
        <article className="panel p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <FlaskConical className="h-5 w-5 text-civic-200" />
            Constituent Impact Summary
          </h2>
          <div className="space-y-3">
            {data.constituentImpact.map((impact) => (
              <div key={impact.id} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{impact.billCode}</p>
                  <p className="text-xs text-civic-100">Impact {Math.round(impact.impactScore * 100)}%</p>
                </div>
                <p className="mt-1 text-xs text-slate-300">{impact.billTitle}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-400">Issue: {impact.issueTag}</p>
                <p className="mt-2 text-sm text-slate-200">{impact.alignment}</p>
                <p className="mt-2 text-xs text-slate-400">{impact.rationale}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <FileChartColumn className="h-5 w-5 text-civic-200" />
            Methodology
          </h2>
          <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Version {data.methodology.version}</p>
            <p className="mt-3 font-mono text-xs text-civic-100">{data.methodology.honesty_score_formula}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.12em] text-slate-400">Rules</p>
            <ul className="mt-2 space-y-2 text-sm">
              {data.methodology.notes.map((note) => (
                <li key={note} className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </article>
      </section>
    </main>
  );
}
