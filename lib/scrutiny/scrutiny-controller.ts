import { z } from "zod";

import { GoogleCustomSearchProvider } from "@/lib/search-providers/google-custom-search";
import { fetchJson, fetchText, normalizeName } from "@/lib/scrapers/utils";
import { fetchGoogleNewsCrossCheck } from "@/lib/services/search/news-crosscheck";
import { parsePeopleQuery } from "@/lib/services/search/query-intent";
import { searchPeopleFromLiveProviders } from "@/lib/services/search/live-provider-search";
import type {
  ActionItem,
  AnalysisModule,
  AnalysisModuleState,
  LiveAnalysisReport,
  PoliticianProfile,
  QuoteEvidence,
  QuoteRelation,
  ScoreBreakdown,
  SourceDocument,
  SourceLink,
  SourceType,
  StatementAnalysisResult,
} from "@/lib/scrutiny/statement-types";

const OpenAiProfileSchema = z.object({
  currentTitle: z.string().min(3),
  currentRole: z.string().min(6),
  party: z.string().optional(),
  politicalCareerStart: z.string().optional(),
  summary: z.string().min(30).max(600),
});

const OpenAiActionsSchema = z.object({
  actions: z
    .array(
      z.object({
        title: z.string().min(8),
        position: z.string().min(2),
        description: z.string().optional(),
        actionDate: z.string().optional(),
        sourceUrl: z.string().url().optional(),
        issueTags: z.array(z.string()).max(8).optional(),
      })
    )
    .max(30),
});

const SCORE_WEIGHTS: ScoreBreakdown["weights"] = {
  consistency: 0.3,
  factAlignment: 0.25,
  sourceReliability: 0.2,
  contextCompleteness: 0.15,
  rhetoric: 0.1,
};

export class ScrutinyController {
  private readonly google = new GoogleCustomSearchProvider();
  private readonly openAiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  private readonly openAiModel = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";

  async analyzeLive(input: {
    politicianQuery: string;
    topic?: string;
    statementText?: string;
    onModuleUpdate?: (module: AnalysisModule, state: AnalysisModuleState, data?: unknown) => void;
  }): Promise<LiveAnalysisReport> {
    const topic = input.topic?.trim() || "public policy";

    const profile = await this.runModule(input.onModuleUpdate, "identity", () =>
      this.resolveProfile(input.politicianQuery, topic)
    );

    const sources = await this.runModule(input.onModuleUpdate, "sources", () =>
      this.collectSourceDocuments(profile, topic)
    );

    const quotes = await this.runModule(input.onModuleUpdate, "statements", () =>
      this.collectDirectQuotes(profile, topic, sources)
    );

    const actions = await this.runModule(input.onModuleUpdate, "actions", () =>
      this.collectActions(profile, topic, sources)
    );

    const selectedStatement = input.statementText?.trim() || quotes[0]?.quote || "";
    const analysis = await this.runModule(input.onModuleUpdate, "analysis", () =>
      this.analyzeStatement({
        selectedStatement,
        profile,
        quotes,
        actions,
        sources,
        topic,
      })
    );

    input.onModuleUpdate?.("verdict", "done", {
      score: analysis.scrutiny.finalScore,
      confidence: analysis.scrutiny.confidence,
      comparedQuotes: analysis.scrutiny.evidenceStats.comparedQuotes,
    });

    return {
      profile,
      topic,
      quotes,
      actions,
      analysis,
      generatedAt: new Date().toISOString(),
      methodology: [
        "Stateless live analysis: no politician records are stored in a database.",
        "Quote-first extraction: only direct quote text or transcript excerpts are used for statement comparisons.",
        "Source reliability tiers: Tier 1 (official government/transcript), Tier 2 (major transcript/reporting), Tier 3 (secondary reporting), Tier 4 (weak/unclear).",
        "Scrutiny score is weighted and explainable: consistency (30%), fact alignment (25%), source reliability (20%), context completeness (15%), rhetoric neutrality (10%).",
        "Confidence is capped when quote count, source quality, or action linkage is limited.",
      ],
    };
  }

  async fetchRandomStatement(input: { politicianQuery: string; topic?: string }): Promise<QuoteEvidence | null> {
    const topic = input.topic?.trim() || "public policy";
    const profile = await this.resolveProfile(input.politicianQuery, topic);
    const sources = await this.collectSourceDocuments(profile, topic);
    const quotes = await this.collectDirectQuotes(profile, topic, sources);

    if (quotes.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * quotes.length);
    return quotes[randomIndex] ?? quotes[0] ?? null;
  }

  private async runModule<T>(
    onModuleUpdate: ((module: AnalysisModule, state: AnalysisModuleState, data?: unknown) => void) | undefined,
    module: AnalysisModule,
    task: () => Promise<T>
  ): Promise<T> {
    onModuleUpdate?.(module, "loading");
    try {
      const data = await task();
      onModuleUpdate?.(module, "done", data);
      return data;
    } catch (error) {
      onModuleUpdate?.(module, "error", {
        error: error instanceof Error ? error.message : `${module} failed`,
      });
      throw error;
    }
  }

  private async resolveProfile(query: string, topic: string): Promise<PoliticianProfile> {
    const parsed = parsePeopleQuery(query);
    const live = await searchPeopleFromLiveProviders({
      query,
      stateCode: parsed.stateHints[0],
      limit: 8,
    });
    const top = live.results[0];

    const web = await this.google.search({
      query: `${query} official biography political career ${topic}`,
      stateCode: top?.state ?? parsed.stateHints[0],
      officeHint: top?.officeDisplay,
      maxResults: 10,
    });

    const sourceLinks: SourceLink[] = web.results.slice(0, 10).map((result) => {
      const tier = inferReliabilityTier(result.link, result.title, result.snippet);
      return {
        label: result.title || result.displayLink,
        url: result.link,
        sourceType: inferSourceType(result.link, result.title, result.snippet),
        reliabilityTier: tier,
      };
    });

    const links = web.results.map((result) => result.link);
    const officialSite = links.find((link) => /\.(gov|mil)\b|congress\.gov|senate\.gov|house\.gov|whitehouse\.gov/i.test(link));
    const campaignSite = links.find((link) => /campaign|for-congress|for-senate|for-governor|for-mayor|elect/i.test(link));

    const fromTop = {
      name: top?.fullName ?? toTitleCase(query),
      currentTitle: top?.officeDisplay ?? "Political figure",
      currentRole: inferRoleSummary(top?.officeDisplay ?? "political figure"),
      party: top?.party ?? undefined,
      state: top?.state ?? undefined,
      politicalCareerStart: inferCareerStartFromSnippets(web.results.map((item) => `${item.title} ${item.snippet}`)),
      summary: inferProfileSummary(top?.officeDisplay ?? "Political figure", web.results.map((item) => item.snippet)),
    };

    const aiProfile = await this.callOpenAiJson(OpenAiProfileSchema, {
      instruction:
        "Create a short grounded profile. Use only provided snippets. If uncertain, state approximate year language. Return JSON only.",
      payload: {
        personQuery: query,
        liveTopResult: top,
        webResults: web.results.slice(0, 10),
      },
      useWebSearch: false,
    });

    return {
      query,
      name: fromTop.name,
      currentTitle: aiProfile?.currentTitle ?? fromTop.currentTitle,
      currentRole: aiProfile?.currentRole ?? fromTop.currentRole,
      party: aiProfile?.party ?? fromTop.party ?? null,
      state: fromTop.state ?? null,
      politicalCareerStart: normalizeCareerStart(aiProfile?.politicalCareerStart ?? fromTop.politicalCareerStart),
      summary: (aiProfile?.summary ?? fromTop.summary).slice(0, 400),
      officialSite,
      campaignSite,
      socials: links.filter((link) => /x\.com|twitter\.com|facebook\.com|instagram\.com|youtube\.com|tiktok\.com/i.test(link)).slice(0, 8),
      sourceLinks,
    };
  }

  private async collectSourceDocuments(profile: PoliticianProfile, topic: string): Promise<SourceDocument[]> {
    const searchQueries = [
      `${profile.name} ${topic} transcript`,
      `${profile.name} ${topic} speech transcript`,
      `${profile.name} ${topic} interview transcript`,
      `${profile.name} ${topic} debate transcript`,
      `site:congress.gov ${profile.name} ${topic}`,
      `site:senate.gov ${profile.name} ${topic}`,
      `site:house.gov ${profile.name} ${topic}`,
      `site:whitehouse.gov ${profile.name} ${topic}`,
      `site:c-span.org ${profile.name} ${topic}`,
      `site:ballotpedia.org ${profile.name}`,
      `${profile.name} ${topic} press release`,
    ];

    const searchResults = await Promise.all(
      searchQueries.map((query) =>
        this.google.search({
          query,
          stateCode: profile.state ?? undefined,
          officeHint: profile.currentTitle,
          maxResults: 8,
        })
      )
    );

    const docsFromSearch: SourceDocument[] = searchResults.flatMap((response) =>
      response.results.map((result, index) => {
        const sourceType = inferSourceType(result.link, result.title, result.snippet);
        return {
          id: `search-${index + 1}-${safeId(result.link)}`,
          title: result.title,
          snippet: sanitizeText(result.snippet),
          url: result.link,
          publishedAt: undefined,
          domain: extractDomain(result.link),
          sourceType,
          reliabilityTier: inferReliabilityTier(result.link, result.title, result.snippet),
          retrievalDate: new Date().toISOString(),
        };
      })
    );

    const news = await fetchGoogleNewsCrossCheck(`${profile.name} ${topic}`, 35);
    const docsFromNews: SourceDocument[] = (news?.entries ?? []).map((entry, index) => {
      const sourceType = inferSourceType(entry.link ?? entry.sourceUrl ?? "", entry.title, entry.title);
      return {
        id: `news-${index + 1}-${safeId(entry.link ?? entry.title)}`,
        title: sanitizeText(entry.title),
        snippet: sanitizeText(entry.title),
        url: entry.link ?? entry.sourceUrl ?? "",
        publishedAt: entry.publishedAt,
        domain: entry.source,
        sourceType,
        reliabilityTier: inferReliabilityTier(entry.link ?? entry.sourceUrl ?? "", entry.title, entry.title),
        retrievalDate: new Date().toISOString(),
      };
    });

    return dedupeDocuments([...docsFromSearch, ...docsFromNews])
      .sort((a, b) => {
        if (a.reliabilityTier !== b.reliabilityTier) {
          return a.reliabilityTier - b.reliabilityTier;
        }
        const aTranscript = isTranscriptLike(a);
        const bTranscript = isTranscriptLike(b);
        if (aTranscript !== bTranscript) {
          return bTranscript ? 1 : -1;
        }
        return 0;
      })
      .slice(0, 48);
  }

  private async collectDirectQuotes(
    profile: PoliticianProfile,
    topic: string,
    docs: SourceDocument[]
  ): Promise<QuoteEvidence[]> {
    const aliases = buildSpeakerAliases(profile.name, profile.currentTitle);
    const quotePool: QuoteEvidence[] = [];

    for (const doc of docs) {
      const snippetQuotes = extractQuotedSegments(doc.snippet).slice(0, 3);
      for (const quote of snippetQuotes) {
        quotePool.push({
          id: `snippet-${safeId(`${doc.id}-${quote}`)}`,
          quote,
          speaker: profile.name,
          date: doc.publishedAt,
          sourceName: doc.domain,
          sourceUrl: doc.url,
          sourceType: doc.sourceType,
          reliabilityTier: doc.reliabilityTier,
        });
      }
    }

    const fetchCandidates = docs.filter((doc) => doc.reliabilityTier <= 3).slice(0, 16);
    const pageResults = await Promise.allSettled(
      fetchCandidates.map(async (doc) => {
        const html = await fetchText(doc.url, undefined, 9000);
        return { doc, html };
      })
    );

    for (const result of pageResults) {
      if (result.status !== "fulfilled") {
        continue;
      }

      const { doc, html } = result.value;
      const parsed = parseHtmlToText(html);
      const quoted = extractQuotedSegments(parsed.text).slice(0, 10);
      const transcriptLines = extractTranscriptLines(parsed.text, aliases).slice(0, 12);
      const excerptLines = extractStatementExcerpts(parsed.text, doc.sourceType).slice(0, 6);

      for (const quote of [...quoted, ...transcriptLines, ...excerptLines]) {
        quotePool.push({
          id: `doc-${safeId(`${doc.id}-${quote}`)}`,
          quote,
          speaker: profile.name,
          date: doc.publishedAt ?? parsed.publishedAt,
          sourceName: doc.domain,
          sourceUrl: doc.url,
          sourceType: doc.sourceType,
          reliabilityTier: doc.reliabilityTier,
        });
      }
    }

    return dedupeQuotes(
      quotePool
        .map((item) => ({ ...item, quote: sanitizeText(item.quote) }))
        .filter((item) => isUsableQuote(item.quote))
        .map((item) => ({
          ...item,
          id: item.id || safeId(`${item.sourceUrl}-${item.quote}`),
          quote: normalizeQuotePunctuation(item.quote),
          date: coerceIsoDate(item.date),
        }))
        .map((item) => ({ ...item, sourceType: item.sourceType || inferSourceType(item.sourceUrl, "", item.quote) }))
    )
      .filter((item) => quoteMentionsTopic(item.quote, topic) || item.sourceType !== "article")
      .slice(0, 220);
  }

  private async collectActions(
    profile: PoliticianProfile,
    topic: string,
    docs: SourceDocument[]
  ): Promise<ActionItem[]> {
    const propublicaActions = await this.fetchProPublicaActions(profile, topic);

    const aiActions = await this.callOpenAiJson(OpenAiActionsSchema, {
      instruction:
        "Extract recent policy actions (votes, bills, executive actions). Use only provided sources. If uncertain, skip the action.",
      payload: {
        person: profile.name,
        currentTitle: profile.currentTitle,
        topic,
        sources: docs.slice(0, 25),
      },
      useWebSearch: false,
    });

    const mappedAi: ActionItem[] = (aiActions?.actions ?? []).map((action, index) => ({
      id: `ai-action-${index + 1}`,
      title: sanitizeText(action.title),
      position: action.position,
      description: action.description ? sanitizeText(action.description) : undefined,
      actionDate: coerceIsoDate(action.actionDate),
      sourceUrl: action.sourceUrl,
      issueTags: action.issueTags ?? inferIssueTags(`${action.title} ${action.description ?? ""}`),
    }));

    const docDerived: ActionItem[] = docs
      .filter((doc) => /vote|bill|legislation|signed|veto|sponsor|introduced|resolution|executive/i.test(`${doc.title} ${doc.snippet}`))
      .slice(0, 20)
      .map((doc, index) => ({
        id: `doc-action-${index + 1}`,
        title: doc.title,
        position: inferActionPosition(`${doc.title} ${doc.snippet}`),
        description: doc.snippet,
        actionDate: doc.publishedAt,
        sourceUrl: doc.url,
        issueTags: inferIssueTags(`${doc.title} ${doc.snippet}`),
      }));

    return dedupeActions([...propublicaActions, ...mappedAi, ...docDerived]).slice(0, 24);
  }

  private async fetchProPublicaActions(profile: PoliticianProfile, topic: string): Promise<ActionItem[]> {
    const apiKey = process.env.PROPUBLICA_API_KEY?.trim();
    if (!apiKey || apiKey.startsWith("replace-with")) {
      return [];
    }

    const congress = process.env.PROPUBLICA_CONGRESS_SESSION?.trim() || "119";
    const headers = { "X-API-Key": apiKey };

    try {
      const [house, senate] = await Promise.all([
        fetchJson<{ results?: Array<{ members?: Array<{ id?: string; first_name?: string; last_name?: string; state?: string }> }> }>(
          `https://api.propublica.org/congress/v1/${congress}/house/members.json`,
          { headers }
        ),
        fetchJson<{ results?: Array<{ members?: Array<{ id?: string; first_name?: string; last_name?: string; state?: string }> }> }>(
          `https://api.propublica.org/congress/v1/${congress}/senate/members.json`,
          { headers }
        ),
      ]);

      const targetName = normalizeName(profile.name);
      const member = [...(house.results?.[0]?.members ?? []), ...(senate.results?.[0]?.members ?? [])].find((candidate) => {
        const candidateName = normalizeName(`${candidate.first_name ?? ""} ${candidate.last_name ?? ""}`);
        const stateMatch = profile.state ? candidate.state?.toUpperCase() === profile.state.toUpperCase() : true;
        return stateMatch && (candidateName.includes(targetName) || targetName.includes(candidateName));
      });

      if (!member?.id) {
        return [];
      }

      const votes = await fetchJson<{
        results?: Array<{
          votes?: Array<{
            date?: string;
            position?: string;
            description?: string;
            question?: string;
            bill?: { number?: string; title?: string };
          }>;
        }>;
      }>(`https://api.propublica.org/congress/v1/members/${member.id}/votes.json`, { headers });

      return (votes.results?.[0]?.votes ?? []).slice(0, 20).map((vote, index) => {
        const title = vote.bill?.title ?? vote.description ?? vote.question ?? "Legislative action";
        return {
          id: `propublica-${index + 1}`,
          title,
          position: vote.position ?? "UNKNOWN",
          description: vote.description,
          actionDate: coerceIsoDate(vote.date),
          sourceUrl: `https://api.propublica.org/congress/v1/members/${member.id}/votes.json`,
          issueTags: inferIssueTags(`${title} ${vote.description ?? ""} ${topic}`),
        };
      });
    } catch {
      return [];
    }
  }

  private async analyzeStatement(input: {
    selectedStatement: string;
    profile: PoliticianProfile;
    quotes: QuoteEvidence[];
    actions: ActionItem[];
    sources: SourceDocument[];
    topic: string;
  }): Promise<StatementAnalysisResult> {
    const selectedStatement = sanitizeText(input.selectedStatement);
    const fallbackStatement = input.quotes[0]?.quote ?? "";
    const statementText = selectedStatement || fallbackStatement;

    const selectedFromPool = input.quotes.find((item) => normalizeName(item.quote) === normalizeName(statementText));

    const statementCard: QuoteEvidence =
      selectedFromPool ??
      ({
        id: `input-${safeId(statementText)}`,
        quote: statementText || "No statement provided.",
        speaker: input.profile.name,
        date: undefined,
        sourceName: "User input",
        sourceUrl: "",
        sourceType: "article",
        reliabilityTier: 4,
      } as QuoteEvidence);

    const comparableRows = input.quotes
      .filter((quote) => normalizeName(quote.quote) !== normalizeName(statementCard.quote))
      .map((quote) => {
        const relation = compareQuotes(statementCard.quote, quote.quote);
        return {
          quote: {
            ...quote,
            relation: relation.relation,
            rationale: relation.rationale,
          },
          similarity: relation.similarity,
        };
      })
      .filter((row) => row.similarity >= 0.12 || row.quote.relation !== "unclear")
      .sort((a, b) => {
        const relationRank = relationPriority(b.quote.relation) - relationPriority(a.quote.relation);
        if (relationRank !== 0) {
          return relationRank;
        }
        return b.similarity - a.similarity;
      });

    const statementsCompared = comparableRows.slice(0, 20).map((row) => row.quote);
    const supportingEvidence = statementsCompared.filter((item) => item.relation === "supports").slice(0, 10);
    const contradictoryEvidence = statementsCompared
      .filter((item) => item.relation === "contradicts" || item.relation === "partially_conflicts")
      .slice(0, 10);

    const relatedStatements = [...statementsCompared]
      .sort((a, b) => overlapScore(statementCard.quote, b.quote) - overlapScore(statementCard.quote, a.quote))
      .slice(0, 10);

    const score = calculateScrutinyBreakdown({
      statement: statementCard.quote,
      compared: statementsCompared,
      actions: input.actions,
      topic: input.topic,
    });

    const sourceLinks = dedupeSourceLinks(
      [
        ...statementsCompared.map((quote) => ({
          label: `${quote.sourceName} (Tier ${quote.reliabilityTier})`,
          url: quote.sourceUrl,
          sourceType: quote.sourceType,
          reliabilityTier: quote.reliabilityTier,
        })),
        ...input.sources.slice(0, 12).map((source) => ({
          label: `${source.domain} (Tier ${source.reliabilityTier})`,
          url: source.url,
          sourceType: source.sourceType,
          reliabilityTier: source.reliabilityTier,
        })),
      ].filter((item) => Boolean(item.url))
    ).slice(0, 24);

    return {
      selectedStatement: statementCard.quote,
      statementCard,
      scoreBand: scoreBand(score.finalScore),
      scrutiny: score,
      statementsCompared,
      supportingEvidence,
      contradictoryEvidence,
      relatedStatements,
      sources: sourceLinks,
    };
  }

  private async callOpenAiJson<T extends z.ZodTypeAny>(
    schema: T,
    options: {
      instruction: string;
      payload: unknown;
      useWebSearch: boolean;
    }
  ): Promise<z.infer<T> | null> {
    if (!this.openAiKey || this.openAiKey.startsWith("replace-with")) {
      return null;
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.openAiKey}`,
      },
      body: JSON.stringify({
        model: this.openAiModel,
        tools: options.useWebSearch ? [{ type: "web_search_preview" }] : undefined,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: [
                  "You are a non-partisan political research assistant.",
                  "Use only provided evidence.",
                  "Do not fabricate missing facts.",
                  "Return strict JSON only.",
                ].join(" "),
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `${options.instruction}\n\nPayload:\n${JSON.stringify(options.payload)}`,
              },
            ],
          },
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

    const text = extractOutputText(payload);
    if (!text) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = extractJsonObject(text);
    } catch {
      return null;
    }

    const validation = schema.safeParse(parsed);
    if (!validation.success) {
      return null;
    }

    return validation.data;
  }
}

function calculateScrutinyBreakdown(input: {
  statement: string;
  compared: QuoteEvidence[];
  actions: ActionItem[];
  topic: string;
}): StatementAnalysisResult["scrutiny"] {
  const comparedCount = input.compared.length;
  const supports = input.compared.filter((item) => item.relation === "supports").length;
  const partialConflicts = input.compared.filter((item) => item.relation === "partially_conflicts").length;
  const contradicts = input.compared.filter((item) => item.relation === "contradicts").length;

  const contradictionWeight = contradicts + partialConflicts * 0.7;
  const supportWeight = supports + partialConflicts * 0.3;

  const consistencyScore =
    comparedCount === 0
      ? 42
      : clamp100(32 + (supportWeight / comparedCount) * 70 - (contradictionWeight / comparedCount) * 50);

  const actionSignal = scoreActionAlignment(input.statement, input.actions);
  const factAlignmentScore = clamp100(
    38 + actionSignal.alignmentRatio * 44 + actionSignal.relevanceRatio * 18 - actionSignal.conflictRatio * 18
  );

  const sourceReliabilityScore = scoreSourceReliability(input.compared);
  const contextCompletenessScore = scoreContextCompleteness(input.compared, input.topic);
  const rhetoricScore = scoreRhetoricNeutrality(input.statement);

  const finalScore = clamp100(
    consistencyScore * SCORE_WEIGHTS.consistency +
      factAlignmentScore * SCORE_WEIGHTS.factAlignment +
      sourceReliabilityScore * SCORE_WEIGHTS.sourceReliability +
      contextCompletenessScore * SCORE_WEIGHTS.contextCompleteness +
      rhetoricScore * SCORE_WEIGHTS.rhetoric
  );

  const strongSourceQuotes = input.compared.filter((item) => item.reliabilityTier <= 2).length;
  const uniqueSources = new Set(input.compared.map((item) => item.sourceUrl).filter(Boolean)).size;
  const recentQuotes = input.compared.filter((item) => {
    if (!item.date) {
      return false;
    }
    const timestamp = new Date(item.date).getTime();
    if (Number.isNaN(timestamp)) {
      return false;
    }
    const twoYearsMs = 1000 * 60 * 60 * 24 * 365 * 2;
    return Date.now() - timestamp <= twoYearsMs;
  }).length;

  let confidence: StatementAnalysisResult["scrutiny"]["confidence"] = "Low";
  if (comparedCount >= 14 && strongSourceQuotes >= 10 && uniqueSources >= 6) {
    confidence = "High";
  } else if (comparedCount >= 7 && strongSourceQuotes >= 4 && uniqueSources >= 4) {
    confidence = "Medium";
  }

  if (actionSignal.relevantActions < 2 && confidence === "High") {
    confidence = "Medium";
  }
  if (comparedCount > 0 && recentQuotes < Math.ceil(comparedCount * 0.25) && confidence === "High") {
    confidence = "Medium";
  }
  if (comparedCount < 5) {
    confidence = "Low";
  }

  const limitations: string[] = [];
  if (comparedCount < 5) {
    limitations.push("Only a small number of usable direct quotes were extracted for comparison.");
  }
  if (strongSourceQuotes < Math.ceil(Math.max(1, comparedCount * 0.6))) {
    limitations.push("A significant share of comparison quotes came from secondary reporting rather than official transcripts.");
  }
  if (actionSignal.relevantActions < 2) {
    limitations.push("Few clearly matched policy actions were found for this statement topic.");
  }
  if (input.compared.filter((item) => item.relation === "unclear").length > Math.floor(comparedCount * 0.4)) {
    limitations.push("Many quote relationships were ambiguous and were conservatively labeled unclear.");
  }
  if (comparedCount > 0 && recentQuotes < Math.ceil(comparedCount * 0.25)) {
    limitations.push("Most comparable quotes were not recent, which reduces freshness confidence.");
  }

  const explanation = generateTransparencySummary({
    comparedCount,
    supports,
    contradicts,
    partialConflicts,
    strongSourceQuotes,
    uniqueSources,
    confidence,
    actionSignal,
  });

  return {
    finalScore: Number(finalScore.toFixed(1)),
    confidence,
    breakdown: {
      consistencyScore: Number(consistencyScore.toFixed(1)),
      factAlignmentScore: Number(factAlignmentScore.toFixed(1)),
      sourceReliabilityScore: Number(sourceReliabilityScore.toFixed(1)),
      contextCompletenessScore: Number(contextCompletenessScore.toFixed(1)),
      rhetoricScore: Number(rhetoricScore.toFixed(1)),
      weights: SCORE_WEIGHTS,
    },
    explanation,
    limitations,
    evidenceStats: {
      comparedQuotes: comparedCount,
      supportingQuotes: supports,
      contradictoryQuotes: contradicts + partialConflicts,
      strongSourceQuotes,
      sourcesUsed: uniqueSources,
    },
  };
}

function generateTransparencySummary(input: {
  comparedCount: number;
  supports: number;
  contradicts: number;
  partialConflicts: number;
  strongSourceQuotes: number;
  uniqueSources: number;
  confidence: "High" | "Medium" | "Low";
  actionSignal: { relevantActions: number; alignedActions: number; conflictingActions: number };
}): string {
  const contradictionText =
    input.contradicts + input.partialConflicts > 0
      ? `${input.contradicts + input.partialConflicts} quotes were classified as conflicting.`
      : "No direct contradiction pattern was identified in the extracted quotes.";

  const actionText =
    input.actionSignal.relevantActions > 0
      ? `${input.actionSignal.alignedActions} of ${input.actionSignal.relevantActions} relevant actions aligned with the statement context.`
      : "No clearly matched action records were available for strong policy alignment scoring.";

  return [
    `This score uses ${input.comparedCount} direct quotes from ${input.uniqueSources} sources.`,
    `${input.strongSourceQuotes} quotes came from Tier 1-2 sources (official transcripts/government or major transcript reporting).`,
    contradictionText,
    actionText,
    `Overall analysis confidence is ${input.confidence}.`,
  ].join(" ");
}

function scoreSourceReliability(compared: QuoteEvidence[]): number {
  if (compared.length === 0) {
    return 38;
  }

  const tierValue = (tier: QuoteEvidence["reliabilityTier"]): number => {
    if (tier === 1) return 95;
    if (tier === 2) return 82;
    if (tier === 3) return 64;
    return 42;
  };

  const average = compared.reduce((sum, item) => sum + tierValue(item.reliabilityTier), 0) / compared.length;
  const weakCount = compared.filter((item) => item.reliabilityTier >= 3).length;

  return clamp100(average - weakCount * 1.5);
}

function scoreContextCompleteness(compared: QuoteEvidence[], topic: string): number {
  if (compared.length === 0) {
    return 30;
  }

  const uniqueSources = new Set(compared.map((item) => item.sourceUrl).filter(Boolean)).size;
  const datedQuotes = compared.filter((item) => Boolean(item.date)).length;
  const topicCovered = compared.filter((item) => quoteMentionsTopic(item.quote, topic)).length;

  const quoteDepth = Math.min(58, compared.length * 3.4);
  const sourceBreadth = Math.min(25, uniqueSources * 3.2);
  const dateCoverage = (datedQuotes / compared.length) * 10;
  const topicCoverage = (topicCovered / compared.length) * 12;

  const score = quoteDepth + sourceBreadth + dateCoverage + topicCoverage;
  return compared.length < 5 ? Math.min(55, score) : clamp100(score);
}

function scoreRhetoricNeutrality(statement: string): number {
  const normalized = normalizeName(statement);
  const inflammatoryTerms = [
    "traitor",
    "enemy",
    "destroy",
    "crush",
    "disaster",
    "invasion",
    "radical",
    "war on",
    "evil",
  ];
  const absolutistTerms = ["always", "never", "everyone", "nobody", "guaranteed", "no one", "all of them"];

  const inflammatoryCount = inflammatoryTerms.filter((term) => normalized.includes(term)).length;
  const absolutistCount = absolutistTerms.filter((term) => normalized.includes(term)).length;

  return clamp100(96 - inflammatoryCount * 13 - absolutistCount * 8);
}

function scoreActionAlignment(
  statement: string,
  actions: ActionItem[]
): {
  relevanceRatio: number;
  alignmentRatio: number;
  conflictRatio: number;
  relevantActions: number;
  alignedActions: number;
  conflictingActions: number;
} {
  if (actions.length === 0) {
    return {
      relevanceRatio: 0,
      alignmentRatio: 0,
      conflictRatio: 0,
      relevantActions: 0,
      alignedActions: 0,
      conflictingActions: 0,
    };
  }

  const statementPolarity = inferTextPolarity(statement);
  const scored = actions
    .map((action) => {
      const text = `${action.title} ${action.description ?? ""}`;
      return {
        action,
        relevance: overlapScore(statement, text),
        polarity: inferActionPolarity(action.position),
      };
    })
    .filter((row) => row.relevance >= 0.12)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 10);

  if (scored.length === 0) {
    return {
      relevanceRatio: 0,
      alignmentRatio: 0,
      conflictRatio: 0,
      relevantActions: 0,
      alignedActions: 0,
      conflictingActions: 0,
    };
  }

  let alignedActions = 0;
  let conflictingActions = 0;
  let informativeActions = 0;

  for (const row of scored) {
    if (row.polarity === 0 || statementPolarity === 0) {
      continue;
    }

    informativeActions += 1;
    if (row.polarity === statementPolarity) {
      alignedActions += 1;
    } else {
      conflictingActions += 1;
    }
  }

  const relevanceRatio = scored.reduce((sum, row) => sum + row.relevance, 0) / scored.length;
  const alignmentRatio = informativeActions > 0 ? alignedActions / informativeActions : 0.45;
  const conflictRatio = informativeActions > 0 ? conflictingActions / informativeActions : 0.15;

  return {
    relevanceRatio,
    alignmentRatio,
    conflictRatio,
    relevantActions: scored.length,
    alignedActions,
    conflictingActions,
  };
}

function compareQuotes(selected: string, candidate: string): {
  relation: QuoteRelation;
  rationale: string;
  similarity: number;
} {
  const similarity = overlapScore(selected, candidate);
  const selectedNorm = normalizeName(selected);
  const candidateNorm = normalizeName(candidate);

  const oppositeTerms: Array<[string, string]> = [
    ["increase", "decrease"],
    ["raise", "lower"],
    ["support", "oppose"],
    ["expand", "cut"],
    ["protect", "ban"],
    ["fund", "defund"],
  ];

  const hasOppositeDirection = oppositeTerms.some(
    ([left, right]) =>
      (selectedNorm.includes(left) && candidateNorm.includes(right)) ||
      (selectedNorm.includes(right) && candidateNorm.includes(left))
  );

  const selectedPolarity = inferTextPolarity(selectedNorm);
  const candidatePolarity = inferTextPolarity(candidateNorm);

  if (similarity < 0.1) {
    return {
      relation: "unclear",
      rationale: "Low topical overlap between statements.",
      similarity,
    };
  }

  if (hasOppositeDirection || (selectedPolarity !== 0 && candidatePolarity !== 0 && selectedPolarity !== candidatePolarity && similarity >= 0.16)) {
    return {
      relation: "contradicts",
      rationale: "Statements use opposing direction or stance on overlapping policy language.",
      similarity,
    };
  }

  const selectedHasNegation = /\b(no|not|never|without)\b/.test(selectedNorm);
  const candidateHasNegation = /\b(no|not|never|without)\b/.test(candidateNorm);

  if (similarity >= 0.24 && selectedHasNegation !== candidateHasNegation) {
    return {
      relation: "partially_conflicts",
      rationale: "Statements overlap on topic but differ in scope or conditions.",
      similarity,
    };
  }

  if (similarity >= 0.19) {
    return {
      relation: "supports",
      rationale: "Statements are directionally consistent on the same topic.",
      similarity,
    };
  }

  return {
    relation: "unclear",
    rationale: "Not enough overlap to classify support or conflict confidently.",
    similarity,
  };
}

function relationPriority(relation?: QuoteRelation): number {
  if (relation === "contradicts") return 4;
  if (relation === "partially_conflicts") return 3;
  if (relation === "supports") return 2;
  return 1;
}

function dedupeDocuments(input: SourceDocument[]): SourceDocument[] {
  const map = new Map<string, SourceDocument>();
  for (const doc of input) {
    if (!doc.url) {
      continue;
    }
    if (!map.has(doc.url)) {
      map.set(doc.url, doc);
    }
  }
  return [...map.values()];
}

function dedupeQuotes(input: QuoteEvidence[]): QuoteEvidence[] {
  const seen = new Set<string>();
  const out: QuoteEvidence[] = [];
  for (const item of input) {
    const key = normalizeName(item.quote);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return out;
}

function dedupeActions(input: ActionItem[]): ActionItem[] {
  const seen = new Set<string>();
  const out: ActionItem[] = [];
  for (const item of input) {
    const key = normalizeName(`${item.title} ${item.description ?? ""}`);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return out;
}

function dedupeSourceLinks(input: SourceLink[]): SourceLink[] {
  const seen = new Set<string>();
  const out: SourceLink[] = [];
  for (const item of input) {
    if (!item.url || seen.has(item.url)) {
      continue;
    }
    seen.add(item.url);
    out.push(item);
  }
  return out;
}

function inferIssueTags(text: string): string[] {
  const lower = text.toLowerCase();
  const tags: string[] = [];

  const keywords: Array<[string, string]> = [
    ["health", "healthcare"],
    ["climate", "climate"],
    ["tax", "tax"],
    ["education", "education"],
    ["housing", "housing"],
    ["immigration", "immigration"],
    ["defense", "defense"],
    ["energy", "energy"],
    ["labor", "labor"],
    ["econom", "economy"],
    ["crime", "crime"],
    ["public safety", "public_safety"],
  ];

  for (const [needle, tag] of keywords) {
    if (lower.includes(needle)) {
      tags.push(tag);
    }
  }

  return tags.length > 0 ? tags : ["general_policy"];
}

function overlapScore(a: string, b: string): number {
  const tokensA = new Set(normalizeName(a).split(" ").filter((token) => token.length > 2));
  const tokensB = new Set(normalizeName(b).split(" ").filter((token) => token.length > 2));

  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(tokensA.size, tokensB.size);
}

function inferActionPosition(text: string): string {
  const normalized = normalizeName(text);
  if (/support|back|approve|pass|signed|introduce|sponsor|expand|increase|yes/i.test(normalized)) {
    return "YES";
  }
  if (/oppose|reject|block|veto|against|criticize|cut|decrease|no/i.test(normalized)) {
    return "NO";
  }
  return "UNKNOWN";
}

function inferActionPolarity(position: string): -1 | 0 | 1 {
  const normalized = normalizeName(position);
  if (["yes", "yea", "for", "support", "approve", "pass"].some((term) => normalized.includes(term))) {
    return 1;
  }
  if (["no", "nay", "against", "oppose", "reject", "veto"].some((term) => normalized.includes(term))) {
    return -1;
  }
  return 0;
}

function inferTextPolarity(text: string): -1 | 0 | 1 {
  const normalized = normalizeName(text);
  if (
    /\b(support|expand|increase|fund|protect|approve|back|strengthen|invest)\b/.test(normalized) &&
    !/\b(not|never|oppose|against|ban|cut|reduce)\b/.test(normalized)
  ) {
    return 1;
  }
  if (/\b(oppose|against|ban|cut|reduce|block|reject|defund|veto)\b/.test(normalized)) {
    return -1;
  }
  return 0;
}

function inferRoleSummary(title: string): string {
  const normalized = normalizeName(title);
  if (normalized.includes("president")) {
    return "National executive leadership role responsible for setting federal policy priorities and directing executive agencies.";
  }
  if (normalized.includes("governor")) {
    return "State executive leadership role that signs or vetoes state legislation, proposes budgets, and oversees state agencies.";
  }
  if (normalized.includes("senate") || normalized.includes("senator")) {
    return "Legislative role responsible for sponsoring bills, voting on legislation, and representing constituents in a legislative chamber.";
  }
  if (normalized.includes("representative") || normalized.includes("assembly") || normalized.includes("house")) {
    return "Legislative role focused on drafting, debating, and voting on policy proposals for a defined district or state.";
  }
  if (normalized.includes("mayor")) {
    return "Municipal executive role overseeing city departments, budget priorities, and implementation of local policy.";
  }
  if (normalized.includes("city council") || normalized.includes("school board") || normalized.includes("county")) {
    return "Local elected role responsible for voting on public budgets, ordinances, and policy decisions for the local jurisdiction.";
  }

  return "Public office role with policy decision-making responsibilities within the stated jurisdiction.";
}

function inferProfileSummary(title: string, snippets: string[]): string {
  const firstSnippet = snippets.map((item) => sanitizeText(item)).find((item) => item.length > 40);
  if (firstSnippet) {
    return firstSnippet.slice(0, 280);
  }

  return `${toTitleCase(title)}. ${inferRoleSummary(title)}`;
}

function inferCareerStartFromSnippets(snippets: string[]): string | undefined {
  const years = snippets
    .flatMap((text) => Array.from(text.matchAll(/\b(19\d{2}|20\d{2})\b/g)).map((match) => Number(match[1])))
    .filter((year) => year >= 1960 && year <= new Date().getFullYear())
    .sort((a, b) => a - b);

  if (years.length === 0) {
    return undefined;
  }

  const earliest = years[0];
  if (years.filter((year) => year === earliest).length >= 2) {
    return `${earliest}`;
  }
  return `approximately ${earliest}`;
}

function normalizeCareerStart(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const cleaned = sanitizeText(value);
  if (!cleaned) {
    return undefined;
  }
  return cleaned.slice(0, 40);
}

function inferSourceType(url: string, title: string, snippet: string): SourceType {
  const combined = `${url} ${title} ${snippet}`.toLowerCase();

  if (/speech|remarks|address to|statement by/i.test(combined)) {
    return "speech";
  }
  if (/interview|q&a|town hall/i.test(combined)) {
    return "interview";
  }
  if (/debate/i.test(combined)) {
    return "debate";
  }
  if (/press release|news release|media release/i.test(combined)) {
    return "press_release";
  }
  if (/hearing|committee/i.test(combined)) {
    return "hearing";
  }
  if (/biography|bio|about/i.test(combined) && /\.gov|ballotpedia|house\.gov|senate\.gov|whitehouse\.gov/i.test(combined)) {
    return "official_bio";
  }
  if (/campaign|elect|for congress|for senate|for mayor|for governor/i.test(combined)) {
    return "campaign_site";
  }
  if (/directory|officials|officeholder/i.test(combined)) {
    return "directory";
  }
  return "article";
}

function inferReliabilityTier(url: string, title: string, snippet: string): 1 | 2 | 3 | 4 {
  const combined = `${url} ${title} ${snippet}`.toLowerCase();

  const isTier1 =
    /\.gov\b|congress\.gov|senate\.gov|house\.gov|whitehouse\.gov|c-span\.org/i.test(combined) &&
    /transcript|remarks|hearing|record|bill|vote|committee|speech/i.test(combined);
  if (isTier1) {
    return 1;
  }

  const isTier2 =
    /reuters\.com|apnews\.com|npr\.org|pbs\.org|bbc\.com|politico\.com|thehill\.com|nytimes\.com|washingtonpost\.com|latimes\.com|wsj\.com|usatoday\.com|ballotpedia\.org|opensecrets\.org|propublica\.org/i.test(
      combined
    ) || /transcript|interview|debate|hearing/i.test(combined);
  if (isTier2) {
    return 2;
  }

  const isTier3 = /news|article|analysis|coverage|blog|substack|medium/i.test(combined);
  if (isTier3) {
    return 3;
  }

  return 4;
}

function isTranscriptLike(doc: SourceDocument): boolean {
  return ["speech", "interview", "debate", "hearing", "press_release"].includes(doc.sourceType);
}

function extractQuotedSegments(text: string): string[] {
  const cleaned = sanitizeText(text);
  if (!cleaned) {
    return [];
  }

  const matches = [...cleaned.matchAll(/["“]([^"”]{30,360})["”]/g)].map((match) => sanitizeText(match[1] ?? ""));
  return [...new Set(matches.filter((item) => isUsableQuote(item)))];
}

function buildSpeakerAliases(name: string, title: string): Set<string> {
  const normalizedName = normalizeName(name);
  const parts = normalizedName.split(" ").filter(Boolean);
  const aliases = new Set<string>([normalizedName, ...parts]);
  const normalizedTitle = normalizeName(title);
  if (normalizedTitle) {
    aliases.add(normalizedTitle);
  }

  if (normalizedTitle.includes("president")) {
    aliases.add("the president");
  }
  if (normalizedTitle.includes("governor")) {
    aliases.add("the governor");
  }
  if (normalizedTitle.includes("senator")) {
    aliases.add("senator");
  }
  if (normalizedTitle.includes("representative")) {
    aliases.add("representative");
  }

  return aliases;
}

function extractTranscriptLines(text: string, aliases: Set<string>): string[] {
  const lines = text
    .split(/\n+/)
    .map((line) => sanitizeText(line))
    .filter((line) => line.length > 20);

  const extracted: string[] = [];

  for (const line of lines) {
    const match = line.match(/^([A-Za-z .'-]{2,40}):\s+(.+)$/);
    if (!match) {
      continue;
    }

    const speaker = normalizeName(match[1] ?? "");
    const content = sanitizeText(match[2] ?? "");

    if (!speaker || !content) {
      continue;
    }

    const speakerMatches = [...aliases].some((alias) => alias && speaker.includes(alias));
    if (!speakerMatches) {
      continue;
    }

    if (isUsableQuote(content)) {
      extracted.push(content);
    }
  }

  return [...new Set(extracted)];
}

function extractStatementExcerpts(text: string, sourceType: SourceType): string[] {
  if (!isTranscriptType(sourceType)) {
    return [];
  }

  const sentences = sanitizeText(text)
    .split(/(?<=[.!?])\s+/)
    .map((line) => sanitizeText(line))
    .filter((line) => line.length >= 45 && line.length <= 320)
    .filter((line) => /\b(i|we)\b/i.test(line))
    .filter((line) => /\b(will|support|oppose|plan|intend|propose|commit|vote|signed|introduce)\b/i.test(line));

  return [...new Set(sentences)].slice(0, 20);
}

function isTranscriptType(sourceType: SourceType): boolean {
  return ["speech", "interview", "debate", "hearing", "press_release"].includes(sourceType);
}

function quoteMentionsTopic(quote: string, topic: string): boolean {
  const topicTokens = normalizeName(topic)
    .split(" ")
    .filter((token) => token.length >= 4 && token !== "public" && token !== "policy");

  if (topicTokens.length === 0) {
    return true;
  }

  const normalizedQuote = normalizeName(quote);
  return topicTokens.some((token) => normalizedQuote.includes(token));
}

function isUsableQuote(text: string): boolean {
  const normalized = sanitizeText(text);
  if (normalized.length < 30 || normalized.length > 360) {
    return false;
  }

  if (/https?:\/\//i.test(normalized)) {
    return false;
  }

  const alphaChars = normalized.replace(/[^A-Za-z]/g, "").length;
  return alphaChars >= 20;
}

function normalizeQuotePunctuation(text: string): string {
  return sanitizeText(text)
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function parseHtmlToText(html: string): { text: string; publishedAt?: string } {
  const publishedAt = extractPublishedAt(html);
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const body = withoutScripts
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  const decoded = decodeHtmlEntities(body)
    .replace(/\u00a0/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return {
    text: decoded,
    publishedAt,
  };
}

function extractPublishedAt(html: string): string | undefined {
  const candidates = [
    html.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i)?.[1],
    html.match(/<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i)?.[1],
    html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1],
  ].filter(Boolean) as string[];

  for (const value of candidates) {
    const iso = coerceIsoDate(value);
    if (iso) {
      return iso;
    }
  }

  return undefined;
}

function coerceIsoDate(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

function sanitizeText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

function safeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 32) || "id";
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "source";
  }
}

function scoreBand(score: number): StatementAnalysisResult["scoreBand"] {
  if (score < 20) return "highly_misleading";
  if (score < 40) return "questionable";
  if (score < 60) return "mixed_reliability";
  if (score < 80) return "mostly_consistent";
  return "highly_consistent";
}

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function extractOutputText(payload: {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
}): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  return (
    payload.output
      ?.flatMap((entry) => entry.content ?? [])
      .find((item) => item.type === "output_text" && typeof item.text === "string")?.text ?? ""
  ).trim();
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
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

  throw new Error("No JSON object found");
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
