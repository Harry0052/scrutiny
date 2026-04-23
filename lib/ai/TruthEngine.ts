import { z } from "zod";

import { runLivePeopleIngestion } from "@/lib/data";
import { GoogleCustomSearchProvider } from "@/lib/search-providers/google-custom-search";
import type { WebSearchResult } from "@/lib/search-providers/types";
import { getDashboardData, isDatabaseConfigured, methodology as dashboardMethodology } from "@/lib/services/dashboard";
import { searchPeople } from "@/lib/services/search";
import { fetchGoogleNewsCrossCheck } from "@/lib/services/search/news-crosscheck";
import { parsePeopleQuery } from "@/lib/services/search/query-intent";
import type { Classification } from "@/lib/types";

type DashboardPayload = NonNullable<Awaited<ReturnType<typeof getDashboardData>>>;

type TruthClassification = Classification;

interface FactCheckEntry {
  claim: string;
  claimant?: string;
  publisher?: string;
  reviewRating?: string;
  reviewUrl?: string;
  reviewDate?: string;
}

interface GroundingQueryResult {
  query: string;
  status: "ok" | "error" | "unconfigured" | "rate_limited";
  note: string;
  results: WebSearchResult[];
}

export interface TruthEngineStatementResult {
  statement_id: string;
  bill_id: string;
  classification: TruthClassification;
  confidence_score: number;
  rationale: string;
  statement_text: string;
  vote_position: string | null;
  bill_title: string;
  issue_tags: string[];
  statement_source_url?: string | null;
}

interface DonorInsight {
  donorName: string;
  donorSector: string;
  totalAmountUsd: number;
  conflictActions: Array<{
    billCode: string;
    billTitle: string;
    votePosition: string;
    matchReason: string;
  }>;
}

interface WealthPoint {
  year: number;
  netWorthEstimateUsd: number;
}

interface UserQaItem {
  question: string;
  answer: string;
  confidence_score: number;
  evidence_links: string[];
}

interface ResearchFallback {
  statement_results: TruthEngineStatementResult[];
  donor_insights: DonorInsight[];
  wealth_tracker: {
    trend: WealthPoint[];
  };
  constituent_impact?: {
    alignedCount: number;
    misalignedCount: number;
    insufficientCount: number;
    status: "green" | "red" | "mixed";
    rationale?: string;
  };
  notes: string[];
}

interface TimelineResearch {
  statement_results: TruthEngineStatementResult[];
  notes: string[];
}

export interface TruthEngineOutput {
  status: "ok" | "not_found" | "unavailable";
  query: string;
  topic: string;
  generatedAt: string;
  politician?: {
    id: string;
    slug: string;
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
  donor_insights: DonorInsight[];
  wealth_tracker: {
    trend: WealthPoint[];
    salaryBenchmarkUsd: number;
  };
  constituent_impact: {
    alignedCount: number;
    misalignedCount: number;
    insufficientCount: number;
    status: "green" | "red" | "mixed";
  };
  grounding: {
    google_queries: GroundingQueryResult[];
    fact_checks: FactCheckEntry[];
    news_cross_check: Awaited<ReturnType<typeof fetchGoogleNewsCrossCheck>>;
  };
  methodology_notes: string[];
  warnings: string[];
  user_qa: {
    available: boolean;
    note?: string;
    items: UserQaItem[];
  };
  research_fallback: ResearchFallback;
  hydration?: {
    attempted: boolean;
    persisted: boolean;
    sourceNotes: string[];
  };
}

const OpenAIResultSchema = z.object({
  statement_results: z.array(
    z.object({
      statement_id: z.string().min(1),
      bill_id: z.string().optional(),
      classification: z.enum(["aligned", "contradicted", "unclear"]),
      confidence_score: z.number().min(0).max(1),
      rationale: z.string().min(1),
    })
  ),
});

const OpenAIQaSchema = z.object({
  items: z
    .array(
      z.object({
        question: z.string().min(3),
        answer: z.string().min(8),
        confidence_score: z.number().min(0).max(1),
        evidence_links: z.array(z.string()).max(5),
      })
    )
    .min(1)
    .max(5),
});

const OpenAIResearchSchema = z.object({
  statement_results: z.array(
    z.object({
      statement_text: z.string().min(8),
      bill_title: z.string().min(3),
      vote_position: z.string().nullable().optional(),
      classification: z.enum(["aligned", "contradicted", "unclear"]),
      confidence_score: z.number().min(0).max(1),
      rationale: z.string().min(8),
      issue_tags: z.array(z.string()).max(8).optional(),
      source_url: z.string().url().optional(),
    })
  ),
  donor_insights: z
    .array(
      z.object({
        donorName: z.string().min(2),
        donorSector: z.string().min(1),
        totalAmountUsd: z.number().min(0),
        conflictActions: z
          .array(
            z.object({
              billCode: z.string().min(1),
              billTitle: z.string().min(1),
              votePosition: z.string().min(1),
              matchReason: z.string().min(1),
            })
          )
          .optional(),
      })
    )
    .max(5),
  wealth_tracker: z
    .object({
      trend: z.array(
        z.object({
          year: z.number().int().min(1990).max(2100),
          netWorthEstimateUsd: z.number(),
        })
      ),
    })
    .optional(),
  constituent_impact: z
    .object({
      alignedCount: z.number().int().min(0),
      misalignedCount: z.number().int().min(0),
      insufficientCount: z.number().int().min(0),
      status: z.enum(["green", "red", "mixed"]),
      rationale: z.string().optional(),
    })
    .optional(),
  notes: z.array(z.string()).optional(),
});

const OpenAITimelineSchema = z.object({
  comparisons: z.array(
    z.object({
      statement_text: z.string().min(12),
      statement_date: z.string().optional(),
      action_text: z.string().min(12),
      action_date: z.string().optional(),
      action_type: z.enum(["vote", "executive_action", "bill_sponsorship", "public_action", "other"]).optional(),
      action_direction: z.enum(["toward", "away", "unclear"]).optional(),
      classification: z.enum(["aligned", "contradicted", "unclear"]),
      confidence_score: z.number().min(0).max(1),
      rationale: z.string().min(10),
      source_url: z.string().url().optional(),
      issue_tags: z.array(z.string()).max(8).optional(),
    })
  ),
  notes: z.array(z.string()).optional(),
});

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return Number(value.toFixed(2));
}

function toMoney(value: number): number {
  return Number(value.toFixed(2));
}

function avgRange(min?: number | null, max?: number | null): number {
  if (typeof min === "number" && typeof max === "number") {
    return (min + max) / 2;
  }
  if (typeof min === "number") {
    return min;
  }
  if (typeof max === "number") {
    return max;
  }
  return 0;
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function buildTopic(query: string, data: DashboardPayload, topicInput?: string): string {
  const provided = topicInput?.trim();
  if (provided) {
    return provided;
  }

  const parsed = parsePeopleQuery(query);
  if (parsed.officeHints.length > 0) {
    return parsed.officeHints[0];
  }

  const topTag = data.statementTimeline.flatMap((item) => item.issueTags)[0];
  if (topTag) {
    return topTag;
  }

  return "public policy";
}

async function resolveDashboardPayload(slug: string | undefined, query: string): Promise<DashboardPayload | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }

  if (slug) {
    return getDashboardData(slug);
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return null;
  }

  const results = await searchPeople({ query: trimmedQuery, limit: 1 });
  if (results.length === 0) {
    return null;
  }

  return getDashboardData(results[0].slug);
}

async function resolveDashboardPayloadWithHydration(
  slug: string | undefined,
  query: string
): Promise<{
  data: DashboardPayload | null;
  hydration: { attempted: boolean; persisted: boolean; sourceNotes: string[] };
}> {
  const emptyHydration = { attempted: false, persisted: false, sourceNotes: [] as string[] };
  if (!isDatabaseConfigured()) {
    return { data: null, hydration: emptyHydration };
  }

  const direct = await resolveDashboardPayload(slug, query);
  if (direct) {
    return { data: direct, hydration: emptyHydration };
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery || slug) {
    return { data: null, hydration: emptyHydration };
  }

  const parsed = parsePeopleQuery(trimmedQuery);
  const ingestion = await runLivePeopleIngestion({
    query: trimmedQuery,
    stateCode: parsed.stateHints[0],
    maxRecords: 100,
  });

  const refreshed = await resolveDashboardPayload(undefined, trimmedQuery);
  return {
    data: refreshed,
    hydration: {
      attempted: true,
      persisted: ingestion.persisted,
      sourceNotes: ingestion.sourceNotes,
    },
  };
}

async function fetchFactChecks(query: string): Promise<{ entries: FactCheckEntry[]; note?: string }> {
  const apiKey = process.env.GOOGLE_FACT_CHECK_API_KEY?.trim() || process.env.GOOGLE_CSE_API_KEY?.trim();
  if (!apiKey || apiKey.startsWith("replace-with")) {
    return {
      entries: [],
      note: "Google Fact Check API key not configured (GOOGLE_FACT_CHECK_API_KEY).",
    };
  }

  try {
    const params = new URLSearchParams({
      query,
      key: apiKey,
      languageCode: "en-US",
      pageSize: "5",
    });

    const response = await fetch(`https://factchecktools.googleapis.com/v1alpha1/claims:search?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return { entries: [], note: `Fact Check API HTTP ${response.status}` };
    }

    const payload = (await response.json()) as {
      claims?: Array<{
        text?: string;
        claimant?: string;
        claimReview?: Array<{
          publisher?: { name?: string };
          textualRating?: string;
          url?: string;
          reviewDate?: string;
        }>;
      }>;
    };

    const entries: FactCheckEntry[] = (payload.claims ?? [])
      .map((claim) => {
        const review = claim.claimReview?.[0];
        return {
          claim: claim.text ?? "",
          claimant: claim.claimant,
          publisher: review?.publisher?.name,
          reviewRating: review?.textualRating,
          reviewUrl: review?.url,
          reviewDate: review?.reviewDate,
        };
      })
      .filter((entry) => entry.claim.trim().length > 0)
      .slice(0, 5);

    return { entries };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { entries: [], note: `Fact Check API request failed: ${message}` };
  }
}

function deterministicStatementResults(data: DashboardPayload): TruthEngineStatementResult[] {
  return data.statementVoteFeed
    .filter((item) => Boolean(item.billId))
    .map((item) => ({
      statement_id: item.statementId,
      bill_id: item.billId ?? "",
      classification: item.classification,
      confidence_score: clampConfidence(item.confidenceScore),
      rationale: item.rationale,
      statement_text: item.statementText,
      vote_position: item.votePosition ?? null,
      bill_title: item.billTitle,
      issue_tags: item.issueTags,
      statement_source_url: item.statementSourceUrl,
    }));
}

async function classifyWithOpenAI(args: {
  politicianName: string;
  topic: string;
  statementResults: TruthEngineStatementResult[];
  webEvidence: GroundingQueryResult[];
  factChecks: FactCheckEntry[];
}): Promise<Map<string, Omit<TruthEngineStatementResult, "statement_text" | "vote_position" | "bill_title" | "issue_tags" | "statement_source_url">> | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || apiKey.startsWith("replace-with")) {
    return null;
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
  const evidenceInput = {
    politician: args.politicianName,
    topic: args.topic,
    statements: args.statementResults.map((item) => ({
      statement_id: item.statement_id,
      bill_id: item.bill_id,
      statement_text: item.statement_text,
      vote_position: item.vote_position,
      bill_title: item.bill_title,
      issue_tags: item.issue_tags,
      baseline_classification: item.classification,
      baseline_confidence: item.confidence_score,
      baseline_rationale: item.rationale,
    })),
    web_evidence: args.webEvidence.map((entry) => ({
      query: entry.query,
      status: entry.status,
      results: entry.results.slice(0, 4).map((row) => ({
        title: row.title,
        snippet: row.snippet,
        link: row.link,
        trust_level: row.trustLevel,
      })),
    })),
    fact_checks: args.factChecks,
  };

  const systemPrompt = [
    "You are CivicWatch Truth Engine.",
    "Classify each statement against vote behavior conservatively and non-partisan.",
    "Never fabricate evidence.",
    "Only use: aligned, contradicted, unclear.",
    "If evidence is ambiguous, use unclear with lower confidence.",
    "Confidence must be in [0, 1].",
    "Return strict JSON with a top-level statement_results array.",
  ].join(" ");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Evaluate statement-to-vote consistency using this evidence JSON:\n${JSON.stringify(evidenceInput)}`,
        },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    return null;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    return null;
  }

  const validation = OpenAIResultSchema.safeParse(parsedJson);
  if (!validation.success) {
    return null;
  }

  return new Map(
    validation.data.statement_results.map((item) => [
      item.statement_id,
      {
        statement_id: item.statement_id,
        bill_id: item.bill_id ?? "",
        classification: item.classification,
        confidence_score: clampConfidence(item.confidence_score),
        rationale: item.rationale,
      },
    ])
  );
}

function fallbackQaAnswers(args: {
  politicianName: string;
  topic: string;
  statementResultCount: number;
  donorCount: number;
  hasFactChecks: boolean;
  hasGoogleGrounding: boolean;
  hasNewsCrossCheck: boolean;
}): UserQaItem[] {
  return [
    {
      question: `What is currently available about ${args.politicianName} on ${args.topic}?`,
      answer:
        args.statementResultCount > 0
          ? `CivicWatch found ${args.statementResultCount} statement-to-vote comparison record(s) for this profile.`
          : "CivicWatch did not find comparable statement-to-vote records yet for this profile.",
      confidence_score: 0.55,
      evidence_links: [],
    },
    {
      question: "What supporting evidence is currently connected?",
      answer: [
        args.hasGoogleGrounding ? "Google Search grounding is available." : "Google Search grounding is unavailable.",
        args.hasFactChecks ? "Fact-check entries were retrieved." : "No fact-check entries were retrieved.",
        args.hasNewsCrossCheck ? "News cross-check results were retrieved." : "News cross-check results were not retrieved.",
        args.donorCount > 0 ? `Donor records available: ${args.donorCount}.` : "No donor records are currently available.",
      ].join(" "),
      confidence_score: 0.5,
      evidence_links: [],
    },
    {
      question: "What is still uncertain?",
      answer:
        "When comparable statement/vote links are missing, CivicWatch cannot assign a strong alignment score. Additional official statements, vote mappings, and disclosure records are needed.",
      confidence_score: 0.7,
      evidence_links: [],
    },
  ];
}

async function generateQaWithOpenAI(args: {
  politicianName: string;
  topic: string;
  summary: {
    consistent_actions: number;
    total_statements: number;
    honesty_score: number;
  };
  statementResults: TruthEngineStatementResult[];
  webEvidence: GroundingQueryResult[];
  factChecks: FactCheckEntry[];
  newsCrossCheck: Awaited<ReturnType<typeof fetchGoogleNewsCrossCheck>>;
}): Promise<UserQaItem[] | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || apiKey.startsWith("replace-with")) {
    return null;
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
  const evidenceLinks = args.webEvidence.flatMap((entry) => entry.results.slice(0, 2).map((row) => row.link)).slice(0, 6);
  const factLinks = args.factChecks.map((item) => item.reviewUrl).filter((value): value is string => Boolean(value));

  const promptPayload = {
    politician: args.politicianName,
    topic: args.topic,
    summary: args.summary,
    statement_examples: args.statementResults.slice(0, 6).map((item) => ({
      statement_id: item.statement_id,
      bill_id: item.bill_id,
      classification: item.classification,
      confidence_score: item.confidence_score,
      rationale: item.rationale,
    })),
    web_evidence: args.webEvidence.map((entry) => ({
      query: entry.query,
      status: entry.status,
      note: entry.note,
      results: entry.results.slice(0, 3).map((row) => ({
        title: row.title,
        snippet: row.snippet,
        link: row.link,
      })),
    })),
    fact_checks: args.factChecks.slice(0, 5),
    news_cross_check: args.newsCrossCheck,
  };

  const systemPrompt = [
    "You are CivicWatch assistant.",
    "Answer user-facing political accountability questions with restraint and evidence-first wording.",
    "Do not fabricate records, dates, or votes.",
    "Clearly state uncertainty when data is incomplete.",
    "Return strict JSON with top-level items array.",
  ].join(" ");

  const userPrompt = [
    `Generate 3 concise Q&A items for ${args.politicianName} on ${args.topic}.`,
    "Questions must cover:",
    "1) what evidence exists now",
    "2) what actions/records are observable",
    "3) what is uncertain or missing",
    "Each item needs: question, answer, confidence_score (0-1), evidence_links (0-3 URLs).",
    `Evidence JSON: ${JSON.stringify(promptPayload)}`,
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  const validation = OpenAIQaSchema.safeParse(parsed);
  if (!validation.success) {
    return null;
  }

  return validation.data.items.map((item) => ({
    question: item.question,
    answer: item.answer,
    confidence_score: clampConfidence(item.confidence_score),
    evidence_links:
      item.evidence_links.length > 0
        ? item.evidence_links
        : [...evidenceLinks, ...factLinks].slice(0, 3),
  }));
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to fenced extraction.
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1]);
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error("No JSON object found in model response.");
}

async function generateResearchFallbackWithOpenAI(args: {
  politicianName: string;
  officeTitle: string;
  topic: string;
  webEvidence: GroundingQueryResult[];
  factChecks: FactCheckEntry[];
  newsCrossCheck: Awaited<ReturnType<typeof fetchGoogleNewsCrossCheck>>;
}): Promise<ResearchFallback | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || apiKey.startsWith("replace-with")) {
    return null;
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
  const inputPayload = {
    politician: args.politicianName,
    officeTitle: args.officeTitle,
    topic: args.topic,
    grounding: {
      google_queries: args.webEvidence.map((entry) => ({
        query: entry.query,
        status: entry.status,
        note: entry.note,
        results: entry.results.slice(0, 5).map((row) => ({
          title: row.title,
          snippet: row.snippet,
          link: row.link,
          trustLevel: row.trustLevel,
        })),
      })),
      fact_checks: args.factChecks,
      news_cross_check: args.newsCrossCheck,
    },
  };

  const systemPrompt = [
    "You are CivicWatch evidence extractor.",
    "Use only grounded, source-backed information.",
    "Never fabricate amounts, votes, dates, or donors.",
    "If evidence is insufficient, return empty arrays and explain in notes.",
    "Return strict JSON only.",
  ].join(" ");

  const userPrompt = [
    `Build structured fallback research for ${args.politicianName} (${args.officeTitle}) on topic: ${args.topic}.`,
    "Schema keys required: statement_results, donor_insights, wealth_tracker, constituent_impact, notes.",
    "For statement_results: include only claims tied to a source URL and classify conservatively.",
    "For donor_insights and wealth_tracker: only populate when source evidence is explicit. Otherwise leave empty.",
    "Use constituent_impact status=mixed when uncertain.",
    `Grounding JSON: ${JSON.stringify(inputPayload)}`,
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      tools: [{ type: "web_search_preview" }],
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: userPrompt }] },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  const contentFromBlocks =
    payload.output
      ?.flatMap((entry) => entry.content ?? [])
      .find((content) => content.type === "output_text" && typeof content.text === "string")?.text ?? "";
  const text = (payload.output_text ?? contentFromBlocks ?? "").trim();
  if (!text) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = extractJsonObject(text);
  } catch {
    return null;
  }

  const validation = OpenAIResearchSchema.safeParse(parsed);
  if (!validation.success) {
    return null;
  }

  const transformed: ResearchFallback = {
    statement_results: validation.data.statement_results.slice(0, 8).map((item, index) => ({
      statement_id: `research-statement-${index + 1}`,
      bill_id: `research-bill-${index + 1}`,
      classification: item.classification,
      confidence_score: clampConfidence(item.confidence_score),
      rationale: item.rationale,
      statement_text: item.statement_text,
      vote_position: item.vote_position ?? null,
      bill_title: item.bill_title,
      issue_tags: item.issue_tags ?? ["research_derived"],
      statement_source_url: item.source_url ?? null,
    })),
    donor_insights: validation.data.donor_insights.map((item) => ({
      donorName: item.donorName,
      donorSector: item.donorSector,
      totalAmountUsd: toMoney(item.totalAmountUsd),
      conflictActions: (item.conflictActions ?? []).map((row) => ({
        billCode: row.billCode,
        billTitle: row.billTitle,
        votePosition: row.votePosition,
        matchReason: row.matchReason,
      })),
    })),
    wealth_tracker: {
      trend: (validation.data.wealth_tracker?.trend ?? [])
        .map((point) => ({
          year: point.year,
          netWorthEstimateUsd: toMoney(point.netWorthEstimateUsd),
        }))
        .sort((a, b) => a.year - b.year),
    },
    constituent_impact: validation.data.constituent_impact
      ? {
          alignedCount: validation.data.constituent_impact.alignedCount,
          misalignedCount: validation.data.constituent_impact.misalignedCount,
          insufficientCount: validation.data.constituent_impact.insufficientCount,
          status: validation.data.constituent_impact.status,
          rationale: validation.data.constituent_impact.rationale,
        }
      : undefined,
    notes: validation.data.notes ?? [],
  };

  return transformed;
}

async function generateTimelineComparisonsWithOpenAI(args: {
  politicianName: string;
  officeTitle: string;
  topic: string;
  webEvidence: GroundingQueryResult[];
  factChecks: FactCheckEntry[];
  newsCrossCheck: Awaited<ReturnType<typeof fetchGoogleNewsCrossCheck>>;
  baselineResults: TruthEngineStatementResult[];
}): Promise<TimelineResearch | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || apiKey.startsWith("replace-with")) {
    return null;
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
  const promptPayload = {
    politician: args.politicianName,
    officeTitle: args.officeTitle,
    topic: args.topic,
    baseline_records: args.baselineResults.slice(0, 10).map((row) => ({
      statement_text: row.statement_text,
      bill_title: row.bill_title,
      classification: row.classification,
      confidence_score: row.confidence_score,
      source_url: row.statement_source_url,
    })),
    grounded_sources: {
      google_queries: args.webEvidence.map((entry) => ({
        query: entry.query,
        status: entry.status,
        note: entry.note,
        links: entry.results.map((row) => row.link),
      })),
      fact_checks: args.factChecks,
      news_entries: args.newsCrossCheck?.entries ?? [],
    },
  };

  const systemPrompt = [
    "You are CivicWatch timeline auditor.",
    "Find statement-action comparisons for one politician.",
    "Only include records supported by sources.",
    "Action must occur after statement when dates are known.",
    "Use conservative classification: aligned, contradicted, unclear.",
    "Return strict JSON only.",
  ].join(" ");

  const userPrompt = [
    `Research ${args.politicianName} (${args.officeTitle}) and topic ${args.topic}.`,
    "Collect statement-action pairs where actions occurred after statements.",
    "For each pair provide statement text, action text, optional dates, classification, confidence, rationale, and source_url.",
    "If date order cannot be confirmed, set classification to unclear unless evidence is explicit.",
    "Schema: { comparisons: [...], notes: [...] }",
    `Context JSON: ${JSON.stringify(promptPayload)}`,
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      tools: [{ type: "web_search_preview" }],
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: userPrompt }] },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  const contentFromBlocks =
    payload.output
      ?.flatMap((entry) => entry.content ?? [])
      .find((content) => content.type === "output_text" && typeof content.text === "string")?.text ?? "";
  const text = (payload.output_text ?? contentFromBlocks ?? "").trim();
  if (!text) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = extractJsonObject(text);
  } catch {
    return null;
  }

  const validation = OpenAITimelineSchema.safeParse(parsed);
  if (!validation.success) {
    return null;
  }

  const statementResults = validation.data.comparisons.slice(0, 12).map((entry, index) => ({
    statement_id: `timeline-statement-${index + 1}`,
    bill_id: `timeline-action-${index + 1}`,
    classification: entry.classification,
    confidence_score: clampConfidence(entry.confidence_score),
    rationale: entry.rationale,
    statement_text: entry.statement_text,
    vote_position:
      entry.action_direction === "toward" ? "SUPPORTS" : entry.action_direction === "away" ? "OPPOSES" : "UNKNOWN",
    bill_title: entry.action_text,
    issue_tags: entry.issue_tags ?? [args.topic.toLowerCase().replace(/\s+/g, "_")],
    statement_source_url: entry.source_url ?? null,
  }));

  return {
    statement_results: statementResults,
    notes: validation.data.notes ?? [],
  };
}

function computeSummary(statementResults: TruthEngineStatementResult[]): {
  consistent_actions: number;
  total_statements: number;
  honesty_score: number;
} {
  const comparable = statementResults.filter((item) => Boolean(item.bill_id));
  const consistentActions = comparable.filter((item) => item.classification === "aligned").length;
  const total = comparable.length;

  return {
    consistent_actions: consistentActions,
    total_statements: total,
    honesty_score: total === 0 ? 0 : Number(((consistentActions / total) * 100).toFixed(1)),
  };
}

function buildDonorInsights(data: DashboardPayload): DonorInsight[] {
  const byDonor = new Map<string, { donorName: string; donorSector: string; totalAmountUsd: number }>();

  for (const record of data.donorRecords) {
    const existing = byDonor.get(record.donorName);
    const currentAmount = record.amountUsd;
    if (!existing) {
      byDonor.set(record.donorName, {
        donorName: record.donorName,
        donorSector: record.donorSector,
        totalAmountUsd: currentAmount,
      });
      continue;
    }
    existing.totalAmountUsd += currentAmount;
  }

  const topDonors = [...byDonor.values()]
    .sort((a, b) => b.totalAmountUsd - a.totalAmountUsd)
    .slice(0, 5);

  const voteCorpus = data.voteTimeline.map((vote) => ({
    ...vote,
    text: normalizeToken(`${vote.billTitle} ${vote.issueTags.join(" ")}`),
  }));

  return topDonors.map((donor) => {
    const sectorToken = normalizeToken(donor.donorSector);
    const conflictActions =
      sectorToken && sectorToken !== "unknown"
        ? voteCorpus
            .filter((vote) => vote.text.includes(sectorToken))
            .slice(0, 3)
            .map((vote) => ({
              billCode: vote.billCode,
              billTitle: vote.billTitle,
              votePosition: vote.votePosition,
              matchReason: `Bill metadata overlaps donor sector keyword \"${donor.donorSector}\".`,
            }))
        : [];

    return {
      donorName: donor.donorName,
      donorSector: donor.donorSector,
      totalAmountUsd: toMoney(donor.totalAmountUsd),
      conflictActions,
    };
  });
}

function buildWealthTrend(data: DashboardPayload): WealthPoint[] {
  return data.disclosureHistory
    .map((disclosure) => {
      const assetValue = disclosure.assets.reduce((sum, asset) => sum + avgRange(asset.valueMinUsd, asset.valueMaxUsd), 0);
      const liabilityValue = disclosure.liabilities.reduce(
        (sum, liability) => sum + avgRange(liability.amountMinUsd, liability.amountMaxUsd),
        0
      );

      return {
        year: disclosure.filingYear,
        netWorthEstimateUsd: toMoney(assetValue - liabilityValue),
      };
    })
    .sort((a, b) => a.year - b.year);
}

function buildConstituentImpact(data: DashboardPayload): TruthEngineOutput["constituent_impact"] {
  const alignedCount = data.constituentImpact.filter((item) => item.alignment.includes("Aligned")).length;
  const partialCount = data.constituentImpact.filter((item) => item.alignment.includes("Partially")).length;
  const misalignedCount = data.constituentImpact.filter((item) => item.alignment.includes("Misaligned")).length;
  const insufficientCount = data.constituentImpact.length - alignedCount - partialCount - misalignedCount;

  let status: "green" | "red" | "mixed" = "mixed";
  if (alignedCount + partialCount > misalignedCount) {
    status = "green";
  } else if (misalignedCount > alignedCount + partialCount) {
    status = "red";
  }

  return {
    alignedCount: alignedCount + partialCount,
    misalignedCount,
    insufficientCount,
    status,
  };
}

export async function runTruthEngine(params: {
  query: string;
  slug?: string;
  topic?: string;
}): Promise<TruthEngineOutput> {
  const query = params.query.trim();
  const { data: dashboardData, hydration } = await resolveDashboardPayloadWithHydration(params.slug, query);

  if (!dashboardData) {
    return {
      status: isDatabaseConfigured() ? "not_found" : "unavailable",
      query,
      topic: params.topic?.trim() || "public policy",
      generatedAt: new Date().toISOString(),
      honesty_formula: dashboardMethodology.honesty_score_formula,
      statement_results: [],
      donor_insights: [],
      wealth_tracker: {
        trend: [],
        salaryBenchmarkUsd: 174000,
      },
      constituent_impact: {
        alignedCount: 0,
        misalignedCount: 0,
        insufficientCount: 0,
        status: "mixed",
      },
      grounding: {
        google_queries: [],
        fact_checks: [],
        news_cross_check: null,
      },
      research_fallback: {
        statement_results: [],
        donor_insights: [],
        wealth_tracker: { trend: [] },
        constituent_impact: undefined,
        notes: [],
      },
      user_qa: {
        available: false,
        note: "No analyzable political profile was resolved for this query.",
        items: [],
      },
      methodology_notes: dashboardMethodology.notes,
      hydration,
      warnings: [
        isDatabaseConfigured()
          ? "No matching politician with analyzable records was found in the current dataset."
          : "DATABASE_URL is not configured, so Truth Engine analysis is unavailable.",
      ],
    };
  }

  const topic = buildTopic(query, dashboardData, params.topic);
  const politicianName = dashboardData.politician.fullName;

  const googleProvider = new GoogleCustomSearchProvider();
  const groundingQueries = [
    `Recent statements by ${politicianName} on ${topic}`,
    `Fact check ${politicianName} ${topic}`,
  ];

  const googleResults = await Promise.all(
    groundingQueries.map(async (groundingQuery) => {
      const response = await googleProvider.search({
        query: groundingQuery,
        stateCode: dashboardData.politician.jurisdictionState ?? undefined,
        officeHint: dashboardData.politician.officeTitle,
        maxResults: 6,
      });

      return {
        query: groundingQuery,
        status: response.status,
        note: response.note,
        results: response.results,
      } as GroundingQueryResult;
    })
  );

  const factCheckResponse = await fetchFactChecks(`${politicianName} ${topic}`);
  const newsCrossCheck = await fetchGoogleNewsCrossCheck(`${politicianName} ${topic}`, 5);

  const baselineResults = deterministicStatementResults(dashboardData);

  const openAiResults = await classifyWithOpenAI({
    politicianName,
    topic,
    statementResults: baselineResults,
    webEvidence: googleResults,
    factChecks: factCheckResponse.entries,
  });

  const statementResults = baselineResults.map((row) => {
    const llm = openAiResults?.get(row.statement_id);
    if (!llm) {
      return row;
    }

    return {
      ...row,
      bill_id: llm.bill_id || row.bill_id,
      classification: llm.classification,
      confidence_score: clampConfidence(llm.confidence_score),
      rationale: llm.rationale,
    };
  });

  const researchFallback = await generateResearchFallbackWithOpenAI({
    politicianName,
    officeTitle: dashboardData.politician.officeTitle,
    topic,
    webEvidence: googleResults,
    factChecks: factCheckResponse.entries,
    newsCrossCheck,
  });
  const timelineResearch = await generateTimelineComparisonsWithOpenAI({
    politicianName,
    officeTitle: dashboardData.politician.officeTitle,
    topic,
    webEvidence: googleResults,
    factChecks: factCheckResponse.entries,
    newsCrossCheck,
    baselineResults,
  });

  const nativeDonorInsights = buildDonorInsights(dashboardData);
  const nativeWealthTrend = buildWealthTrend(dashboardData);
  const nativeConstituentImpact = buildConstituentImpact(dashboardData);

  const effectiveStatementResults =
    timelineResearch?.statement_results.length
      ? timelineResearch.statement_results
      : statementResults.length > 0
        ? statementResults
        : researchFallback?.statement_results ?? statementResults;
  const effectiveDonorInsights =
    nativeDonorInsights.length > 0
      ? nativeDonorInsights
      : researchFallback?.donor_insights ?? [];
  const effectiveWealthTrend =
    nativeWealthTrend.length > 0
      ? nativeWealthTrend
      : researchFallback?.wealth_tracker.trend ?? [];
  const effectiveConstituentImpact =
    dashboardData.constituentImpact.length > 0
      ? nativeConstituentImpact
      : researchFallback?.constituent_impact
        ? {
            alignedCount: researchFallback.constituent_impact.alignedCount,
            misalignedCount: researchFallback.constituent_impact.misalignedCount,
            insufficientCount: researchFallback.constituent_impact.insufficientCount,
            status: researchFallback.constituent_impact.status,
          }
        : nativeConstituentImpact;

  const summary = computeSummary(effectiveStatementResults);
  const generatedQa = await generateQaWithOpenAI({
    politicianName,
    topic,
    summary,
    statementResults: effectiveStatementResults,
    webEvidence: googleResults,
    factChecks: factCheckResponse.entries,
    newsCrossCheck,
  });

  const fallbackQa = fallbackQaAnswers({
    politicianName,
    topic,
    statementResultCount: effectiveStatementResults.length,
    donorCount: effectiveDonorInsights.length,
    hasFactChecks: factCheckResponse.entries.length > 0,
    hasGoogleGrounding: googleResults.some((entry) => entry.status === "ok"),
    hasNewsCrossCheck: Boolean(newsCrossCheck?.articleCount),
  });

  const userQa = generatedQa ?? fallbackQa;
  const warnings: string[] = [];

  if (!openAiResults && baselineResults.length > 0) {
    warnings.push("OpenAI classification unavailable; using deterministic baseline classification.");
  }
  if (!generatedQa) {
    warnings.push("OpenAI Q&A unavailable; using deterministic evidence summary answers.");
  }
  if (researchFallback && researchFallback.notes.length > 0) {
    warnings.push(...researchFallback.notes.slice(0, 3));
  }
  if (timelineResearch && timelineResearch.notes.length > 0) {
    warnings.push(...timelineResearch.notes.slice(0, 3));
  }
  if (!researchFallback && effectiveStatementResults.length === 0) {
    warnings.push("OpenAI research fallback unavailable; sections may remain sparse.");
  }
  if (!timelineResearch && baselineResults.length === 0) {
    warnings.push("OpenAI timeline comparison unavailable; truth score may remain low-confidence.");
  }
  if (timelineResearch && timelineResearch.statement_results.length > 0) {
    warnings.push(`OpenAI timeline comparison generated ${timelineResearch.statement_results.length} statement-action pair(s).`);
  }

  if (googleResults.every((entry) => entry.status !== "ok")) {
    warnings.push("Google Search grounding unavailable; configure GOOGLE_CSE_API_KEY and GOOGLE_CSE_ENGINE_ID.");
  }

  if (factCheckResponse.note) {
    warnings.push(factCheckResponse.note);
  }
  if (hydration.attempted && hydration.sourceNotes.length > 0) {
    warnings.push(`Live-source ingestion attempted for this query (${hydration.sourceNotes.length} provider note(s)).`);
  }

  return {
    status: "ok",
    query,
    topic,
    generatedAt: new Date().toISOString(),
    politician: {
      id: dashboardData.politician.id,
      slug: dashboardData.politician.slug,
      fullName: dashboardData.politician.fullName,
      party: dashboardData.politician.party,
      officeTitle: dashboardData.politician.officeTitle,
      jurisdictionState: dashboardData.politician.jurisdictionState,
      jurisdictionLevel: dashboardData.politician.jurisdictionLevel,
    },
    summary,
    honesty_formula: dashboardMethodology.honesty_score_formula,
    statement_results: effectiveStatementResults,
    donor_insights: effectiveDonorInsights,
    wealth_tracker: {
      trend: effectiveWealthTrend,
      salaryBenchmarkUsd: 174000,
    },
    constituent_impact: effectiveConstituentImpact,
    grounding: {
      google_queries: googleResults,
      fact_checks: factCheckResponse.entries,
      news_cross_check: newsCrossCheck,
    },
    research_fallback: researchFallback ?? {
      statement_results: [],
      donor_insights: [],
      wealth_tracker: { trend: [] },
      constituent_impact: undefined,
      notes: [],
    },
    user_qa: {
      available: Boolean(generatedQa),
      note: generatedQa ? "Generated with OpenAI from current grounding and record evidence." : "Fallback summary generated from available records and grounding status.",
      items: userQa,
    },
    methodology_notes: [
      ...dashboardMethodology.notes,
      "Grounding queries are issued before classification to collect current public evidence.",
      "Truth labels are conservative and default to unclear when evidence is ambiguous.",
      "When database statement-vote links are sparse, OpenAI timeline research compares sourced statements to later actions and recalculates score.",
    ],
    warnings,
    hydration,
  };
}
