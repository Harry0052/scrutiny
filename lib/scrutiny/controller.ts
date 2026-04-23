import { z } from "zod";

import { GoogleCustomSearchProvider } from "@/lib/search-providers/google-custom-search";
import { OpenSecretsConnector } from "@/lib/scrapers/connectors/opensecrets";
import { FecConnector } from "@/lib/scrapers/connectors/fec";
import { fetchJson, normalizeName } from "@/lib/scrapers/utils";
import { fetchGoogleNewsCrossCheck } from "@/lib/services/search/news-crosscheck";
import { parsePeopleQuery } from "@/lib/services/search/query-intent";
import { searchPeopleFromLiveProviders } from "@/lib/services/search/live-provider-search";
import type {
  CrosscheckSnapshot,
  DonorPolicyCorrelation,
  FinancialSnapshot,
  IdentityProfile,
  LegislativeSnapshot,
  LegislativeVote,
  ModuleState,
  ScrutinyModule,
  ScrutinyReport,
  StatementSnapshot,
  VerdictSnapshot,
  WealthSnapshot,
} from "@/lib/scrutiny/types";

const StatementSchema = z.object({
  statements: z
    .array(
      z.object({
        text: z.string().min(8),
        madeAt: z.string().optional(),
        source: z.string().min(2),
        sourceUrl: z.string().url().optional(),
        topicTags: z.array(z.string()).max(6).optional(),
      })
    )
    .max(8),
});

const CrosscheckSchema = z.object({
  comparisons: z
    .array(
      z.object({
        statementId: z.string(),
        actionId: z.string(),
        actionText: z.string().min(8),
        classification: z.enum(["aligned", "contradicted", "unclear"]),
        confidenceScore: z.number().min(0).max(1),
        rationale: z.string().min(8),
        sourceLinks: z.array(z.string()).max(4).optional(),
      })
    )
    .max(20),
});

const WealthSchema = z.object({
  trend: z
    .array(
      z.object({
        year: z.number().int().min(1990).max(2100),
        netWorthEstimateUsd: z.number(),
        sourceUrl: z.string().url().optional(),
      })
    )
    .max(12),
});

const LegislativeFallbackSchema = z.object({
  votes: z
    .array(
      z.object({
        votedAt: z.string().optional(),
        billCode: z.string().optional(),
        billTitle: z.string().min(8),
        description: z.string().optional(),
        position: z.string().min(2),
        sourceUrl: z.string().url().optional(),
        issueTags: z.array(z.string()).max(8).optional(),
      })
    )
    .max(20),
});

interface AnalyzeInput {
  query: string;
  topic?: string;
  onModuleUpdate?: (module: ScrutinyModule, state: ModuleState, data?: unknown) => void;
}

interface OpenAiResponsesPayload {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
}

export class ScrutinyController {
  private readonly google = new GoogleCustomSearchProvider();
  private readonly fec = new FecConnector();
  private readonly openSecrets = new OpenSecretsConnector();
  private readonly openAiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  private readonly openAiModel = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";

  async analyze(input: AnalyzeInput): Promise<ScrutinyReport> {
    const topic = input.topic?.trim() || "public policy";

    const identity = await this.runModule(input, "identity", () => this.resolveIdentity(input.query, topic));

    const [financials, legislative, statements, wealth] = await Promise.all([
      this.runModule(input, "financials", () => this.fetchFinancials(identity)),
      this.runModule(input, "legislative", () => this.fetchLegislative(identity, topic)),
      this.runModule(input, "statements", () => this.fetchStatements(identity, topic)),
      this.runModule(input, "wealth", () => this.fetchWealth(identity, topic)),
    ]);

    const crosscheck = await this.runModule(input, "crosscheck", () =>
      this.buildCrosscheck(identity, statements, legislative, topic)
    );

    const donorPolicyCorrelation = this.computeDonorPolicyCorrelation(financials, legislative);
    const verdict = this.buildVerdict(crosscheck);
    input.onModuleUpdate?.("verdict", "done", verdict);

    return {
      identity,
      financials,
      legislative,
      statements,
      crosscheck,
      wealth,
      donorPolicyCorrelation,
      verdict,
      scrutinyScore: crosscheck.consistencyIndex,
      generatedAt: new Date().toISOString(),
      methodology: [
        "Stateless session analysis: no person records persisted server-side.",
        "Consistency Index = (Live Votes Aligning with Statements / Total Statements Identified) * 100.",
        "Statement-action comparisons are conservative and marked unclear when evidence is ambiguous.",
        "Donor-policy correlation is a signal based on donor sector and bill/issue tag overlap.",
      ],
    };
  }

  private async runModule<T>(
    input: AnalyzeInput,
    module: ScrutinyModule,
    task: () => Promise<T>
  ): Promise<T> {
    input.onModuleUpdate?.(module, "loading");
    try {
      const data = await task();
      input.onModuleUpdate?.(module, "done", data);
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : `${module} failed`;
      input.onModuleUpdate?.(module, "error", { error: message });
      throw error;
    }
  }

  private async resolveIdentity(query: string, topic: string): Promise<IdentityProfile> {
    const parsed = parsePeopleQuery(query);
    const liveSearch = await searchPeopleFromLiveProviders({
      query,
      stateCode: parsed.stateHints[0],
      limit: 8,
    });
    const top = liveSearch.results[0];

    const web = await this.google.search({
      query: `${query} official website campaign ${topic}`,
      stateCode: top?.state ?? parsed.stateHints[0],
      officeHint: top?.officeDisplay,
      maxResults: 10,
    });

    const links = web.results.map((item) => item.link);
    const officialWebsite = links.find((url) => /\.(gov|house\.gov|senate\.gov|congress\.gov)\b/i.test(url));
    const campaignWebsite = links.find(
      (url) => !/\.gov\b/i.test(url) && /campaign|for-congress|for-senate|for-governor|for-mayor/i.test(url)
    );

    const socialHandles = links
      .filter((url) => /x\.com|twitter\.com|facebook\.com|instagram\.com|youtube\.com|tiktok\.com/i.test(url))
      .slice(0, 6);

    return {
      query,
      resolvedName: top?.fullName ?? query,
      office: top?.officeDisplay ?? "Political figure",
      party: top?.party ?? null,
      state: top?.state ?? null,
      campaignWebsite,
      officialWebsite,
      socialHandles,
      sourceLinks: web.results.slice(0, 8).map((result) => ({
        label: result.title || result.displayLink,
        url: result.link,
      })),
    };
  }

  private async fetchFinancials(identity: IdentityProfile): Promise<FinancialSnapshot> {
    const [fecResult, openSecretsResult] = await Promise.all([
      this.fec.fetch({
        query: identity.resolvedName,
        stateCode: identity.state ?? undefined,
        maxRecords: 40,
      }),
      this.openSecrets.fetch({
        query: identity.resolvedName,
        stateCode: identity.state ?? undefined,
        maxRecords: 20,
      }),
    ]);

    const byDonor = new Map<
      string,
      { donorName: string; donorType: string; sector?: string; totalAmountUsd: number; sourceUrl?: string }
    >();

    for (const row of fecResult.payload.donorContributions) {
      const existing = byDonor.get(row.donorName);
      if (!existing) {
        byDonor.set(row.donorName, {
          donorName: row.donorName,
          donorType: row.donorType,
          sector: row.sector,
          totalAmountUsd: row.amountUsd,
          sourceUrl: row.sourceUrl,
        });
      } else {
        existing.totalAmountUsd += row.amountUsd;
      }
    }

    const topDonors = [...byDonor.values()]
      .sort((a, b) => b.totalAmountUsd - a.totalAmountUsd)
      .slice(0, 5)
      .map((item) => ({
        ...item,
        totalAmountUsd: Number(item.totalAmountUsd.toFixed(2)),
      }));

    return {
      topDonors,
      totalTrackedUsd: Number(
        topDonors.reduce((sum, item) => sum + item.totalAmountUsd, 0).toFixed(2)
      ),
      sourceNotes: [
        `FEC: ${fecResult.note}`,
        `OpenSecrets: ${openSecretsResult.note}`,
      ],
    };
  }

  private async fetchLegislative(identity: IdentityProfile, topic: string): Promise<LegislativeSnapshot> {
    const propublicaVotes = await this.fetchProPublicaVotes(identity, topic);
    if (propublicaVotes.length > 0) {
      return {
        votes: propublicaVotes,
        sourceNotes: [`ProPublica votes fetched: ${propublicaVotes.length}`],
      };
    }

    const fallbackVotes = await this.generateLegislativeFallback(identity, topic);
    return {
      votes: fallbackVotes.length > 0 ? fallbackVotes : await this.fetchLegislativeFromNews(identity, topic),
      sourceNotes:
        fallbackVotes.length > 0
          ? ["OpenAI web-research fallback generated legislative actions."]
          : ["Using Google News live-action fallback because direct vote feeds were unavailable."],
    };
  }

  private async fetchLegislativeFromNews(identity: IdentityProfile, topic: string): Promise<LegislativeVote[]> {
    const news = await fetchGoogleNewsCrossCheck(
      `${identity.resolvedName} voted OR introduced bill OR signed law OR executive action ${topic}`,
      20
    );

    return (news?.entries ?? []).slice(0, 20).map((entry, index) => ({
      voteId: `news-action-${index + 1}`,
      votedAt: entry.publishedAt,
      billTitle: entry.title,
      description: `${entry.source} news action signal`,
      position: inferActionPosition(entry.title),
      sourceUrl: entry.link,
      issueTags: augmentTagsWithTopic(inferIssueTags(entry.title), entry.title, topic),
    }));
  }

  private async fetchProPublicaVotes(identity: IdentityProfile, topic: string): Promise<LegislativeVote[]> {
    const apiKey = process.env.PROPUBLICA_API_KEY?.trim();
    if (!apiKey || apiKey.startsWith("replace-with")) {
      return [];
    }

    const congress = process.env.PROPUBLICA_CONGRESS_SESSION?.trim() || "119";
    const headers = { "X-API-Key": apiKey };

    try {
      const [houseMembers, senateMembers] = await Promise.all([
        fetchJson<{ results?: Array<{ members?: Array<{ id?: string; first_name?: string; last_name?: string; state?: string }> }> }>(
          `https://api.propublica.org/congress/v1/${congress}/house/members.json`,
          { headers }
        ),
        fetchJson<{ results?: Array<{ members?: Array<{ id?: string; first_name?: string; last_name?: string; state?: string }> }> }>(
          `https://api.propublica.org/congress/v1/${congress}/senate/members.json`,
          { headers }
        ),
      ]);

      const fullName = normalizeName(identity.resolvedName);
      const target = [...(houseMembers.results?.[0]?.members ?? []), ...(senateMembers.results?.[0]?.members ?? [])].find((member) => {
        const memberName = normalizeName(`${member.first_name ?? ""} ${member.last_name ?? ""}`);
        if (!memberName) {
          return false;
        }

        const stateMatch = identity.state ? member.state?.toUpperCase() === identity.state.toUpperCase() : true;
        return stateMatch && (memberName.includes(fullName) || fullName.includes(memberName));
      });

      if (!target?.id) {
        return [];
      }

      const voteResponse = await fetchJson<{
        results?: Array<{
          votes?: Array<{
            member_id?: string;
            date?: string;
            position?: string;
            description?: string;
            question?: string;
            result?: string;
            bill?: { number?: string; title?: string };
          }>;
        }>;
      }>(`https://api.propublica.org/congress/v1/members/${target.id}/votes.json`, { headers });

      return (voteResponse.results?.[0]?.votes ?? [])
        .slice(0, 20)
        .map((vote, index) => {
          const billTitle = vote.bill?.title ?? vote.description ?? vote.question ?? "Congressional vote";
          return {
            voteId: vote.member_id ? `${vote.member_id}-${index}` : `vote-${index}`,
            votedAt: vote.date,
            billCode: vote.bill?.number,
            billTitle,
            description: vote.description,
            position: vote.position ?? "UNKNOWN",
            sourceUrl: `https://api.propublica.org/congress/v1/members/${target.id}/votes.json`,
            issueTags: augmentTagsWithTopic(
              inferIssueTags(`${billTitle} ${vote.description ?? ""}`),
              `${billTitle} ${vote.description ?? ""}`,
              topic
            ),
          };
        });
    } catch {
      return [];
    }
  }

  private async generateLegislativeFallback(identity: IdentityProfile, topic: string): Promise<LegislativeVote[]> {
    const schema = LegislativeFallbackSchema;
    const response = await this.callOpenAiJson(schema, {
      instruction:
        "Find the most recent public policy actions/votes for this political figure and return up to 20 structured items.",
      payload: {
        name: identity.resolvedName,
        office: identity.office,
        state: identity.state,
        topic,
      },
      useWebSearch: true,
    });

    if (!response) {
      return [];
    }

    return response.votes.slice(0, 20).map((vote, index) => ({
      voteId: `fallback-vote-${index + 1}`,
      votedAt: vote.votedAt,
      billCode: vote.billCode,
      billTitle: vote.billTitle,
      description: vote.description,
      position: vote.position,
      sourceUrl: vote.sourceUrl,
      issueTags: augmentTagsWithTopic(
        vote.issueTags ?? inferIssueTags(`${vote.billTitle} ${vote.description ?? ""}`),
        `${vote.billTitle} ${vote.description ?? ""}`,
        topic
      ),
    }));
  }

  private async fetchStatements(identity: IdentityProfile, topic: string): Promise<StatementSnapshot> {
    const [news, cspan] = await Promise.all([
      fetchGoogleNewsCrossCheck(`${identity.resolvedName} ${topic}`, 12),
      this.google.search({
        query: `site:c-span.org ${identity.resolvedName} ${topic} transcript`,
        stateCode: identity.state ?? undefined,
        maxResults: 10,
      }),
    ]);

    const statementsFromAi = await this.callOpenAiJson(StatementSchema, {
      instruction:
        "Extract up to 5 recent public statements for this person using provided evidence. Preserve dates and source links when available.",
      payload: {
        person: identity.resolvedName,
        topic,
        newsEntries: news?.entries ?? [],
        cspanResults: cspan.results,
      },
      useWebSearch: true,
    });

    if (statementsFromAi) {
      return {
        statements: statementsFromAi.statements.slice(0, 5).map((entry, index) => ({
          statementId: `statement-${index + 1}`,
          text: entry.text,
          madeAt: entry.madeAt,
          source: entry.source,
          sourceUrl: entry.sourceUrl,
          topicTags: augmentTagsWithTopic(entry.topicTags ?? inferIssueTags(entry.text), entry.text, topic),
        })),
        sourceNotes: [
          `Google News entries: ${news?.articleCount ?? 0}`,
          `C-SPAN discovery results: ${cspan.results.length}`,
        ],
      };
    }

    const fallback = (news?.entries ?? []).slice(0, 5).map((entry, index) => ({
      statementId: `news-fallback-${index + 1}`,
      text: entry.title,
      madeAt: entry.publishedAt,
      source: entry.source,
      sourceUrl: entry.link,
      topicTags: augmentTagsWithTopic(inferIssueTags(entry.title), entry.title, topic),
    }));

    return {
      statements: fallback,
      sourceNotes: [
        "Used news headline fallback because OpenAI statement extraction was unavailable.",
      ],
    };
  }

  private async buildCrosscheck(
    identity: IdentityProfile,
    statements: StatementSnapshot,
    legislative: LegislativeSnapshot,
    topic: string
  ): Promise<CrosscheckSnapshot> {
    if (statements.statements.length === 0 || legislative.votes.length === 0) {
      return {
        comparisons: [],
        consistentActions: 0,
        totalStatements: 0,
        consistencyIndex: 0,
        sourceNotes: ["Missing statements or votes for cross-check."],
      };
    }

    const payload = {
      person: identity.resolvedName,
      topic,
      statements: statements.statements,
      votes: legislative.votes,
    };

    const ai = await this.callOpenAiJson(CrosscheckSchema, {
      instruction:
        "Compare statements to actions/votes and classify each as aligned, contradicted, or unclear. Prefer action dates after statement dates.",
      payload,
      useWebSearch: false,
    });

    const comparisons = ai
      ? ai.comparisons
          .map((item) => {
            const statement = statements.statements.find((row) => row.statementId === item.statementId);
            const action = legislative.votes.find((row) => row.voteId === item.actionId);
            if (!statement || !action) {
              return null;
            }
            return {
              statementId: statement.statementId,
              statementText: statement.text,
              actionId: action.voteId,
              actionText: action.billTitle,
              classification: item.classification,
              confidenceScore: Number(item.confidenceScore.toFixed(2)),
              rationale: item.rationale,
              sourceLinks: item.sourceLinks ?? [statement.sourceUrl, action.sourceUrl].filter((x): x is string => Boolean(x)),
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
      : this.lexicalCrosscheck(statements, legislative);

    const totalStatements = comparisons.length;
    const consistentActions = comparisons.filter((item) => item.classification === "aligned").length;
    const consistencyIndex = totalStatements
      ? Number(((consistentActions / totalStatements) * 100).toFixed(1))
      : 0;

    return {
      comparisons,
      consistentActions,
      totalStatements,
      consistencyIndex,
      sourceNotes: ai
        ? ["Cross-check generated by OpenAI over live statements and votes."]
        : ["Used lexical fallback cross-check due unavailable OpenAI result."],
    };
  }

  private lexicalCrosscheck(
    statements: StatementSnapshot,
    legislative: LegislativeSnapshot
  ): CrosscheckSnapshot["comparisons"] {
    return statements.statements.slice(0, 10).map((statement, index) => {
      let bestVote = legislative.votes[index % legislative.votes.length];
      let score = -1;

      for (const candidate of legislative.votes) {
        const candidateTextScore = overlapScore(
          statement.text,
          `${candidate.billTitle} ${candidate.description ?? ""}`
        );
        const candidateTagScore = overlapTagScore(statement.topicTags, candidate.issueTags);
        const candidateScore = Math.max(candidateTextScore, candidateTagScore);
        if (candidateScore > score) {
          score = candidateScore;
          bestVote = candidate;
        }
      }

      const classification: CrosscheckSnapshot["comparisons"][number]["classification"] =
        score >= 0.28 ? "aligned" : score <= 0.09 ? "contradicted" : "unclear";

      return {
        statementId: statement.statementId,
        statementText: statement.text,
        actionId: bestVote.voteId,
        actionText: bestVote.billTitle,
        classification,
        confidenceScore: Number(Math.max(0.3, Math.min(0.8, score + 0.2)).toFixed(2)),
        rationale:
          classification === "aligned"
            ? "Statement topic and live action signal materially overlap."
            : classification === "contradicted"
              ? "Very low overlap between statement and action suggests contradiction risk."
              : "Moderate overlap but insufficient confidence for a strong alignment call.",
        sourceLinks: [statement.sourceUrl, bestVote.sourceUrl].filter((x): x is string => Boolean(x)),
      };
    });
  }

  private async fetchWealth(identity: IdentityProfile, topic: string): Promise<WealthSnapshot> {
    const disclosureSearch = await this.google.search({
      query: `${identity.resolvedName} financial disclosure pdf net worth ${topic}`,
      stateCode: identity.state ?? undefined,
      maxResults: 10,
    });

    const disclosureLinks = disclosureSearch.results
      .filter((item) => /pdf|financial disclosure|ethics/i.test(`${item.title} ${item.snippet} ${item.link}`))
      .slice(0, 8)
      .map((item) => ({ label: item.title || "Disclosure source", url: item.link }));

    const trendFromAi = await this.callOpenAiJson(WealthSchema, {
      instruction:
        "Extract estimated net-worth trend points from publicly reported financial disclosure materials. Only include evidence-backed years.",
      payload: {
        person: identity.resolvedName,
        office: identity.office,
        disclosureLinks,
      },
      useWebSearch: true,
    });

    return {
      disclosureLinks,
      trend: (trendFromAi?.trend ?? [])
        .map((point) => ({
          year: point.year,
          netWorthEstimateUsd: Number(point.netWorthEstimateUsd.toFixed(2)),
          sourceUrl: point.sourceUrl,
        }))
        .sort((a, b) => a.year - b.year),
      sourceNotes: [
        `Disclosure links identified: ${disclosureLinks.length}`,
        trendFromAi ? "OpenAI extracted wealth trend from live sources." : "No structured wealth trend could be extracted.",
      ],
    };
  }

  private computeDonorPolicyCorrelation(
    financials: FinancialSnapshot,
    legislative: LegislativeSnapshot
  ): DonorPolicyCorrelation[] {
    const top = financials.topDonors.slice(0, 3);

    return top.map((donor) => {
      const sectorTokens = normalizeName(donor.sector ?? donor.donorType)
        .split(" ")
        .filter((token) => token.length > 2);

      const matchedActions = legislative.votes
        .filter((vote) => {
          const text = normalizeName(`${vote.billTitle} ${vote.description ?? ""} ${vote.issueTags.join(" ")}`);
          return sectorTokens.some((token) => text.includes(token));
        })
        .slice(0, 4)
        .map((vote) => ({
          voteId: vote.voteId,
          billTitle: vote.billTitle,
          matchReason: `Vote metadata overlaps donor sector token(s): ${sectorTokens.join(", ")}`,
        }));

      return {
        donorName: donor.donorName,
        sector: donor.sector,
        matchedActions,
      };
    });
  }

  private buildVerdict(crosscheck: CrosscheckSnapshot): VerdictSnapshot {
    if (crosscheck.totalStatements === 0) {
      return {
        status: "mixed",
        summary: "Insufficient live statement-action pairs for a district impact verdict.",
      };
    }

    if (crosscheck.consistencyIndex >= 60) {
      return {
        status: "green",
        summary: "Recent actions are mostly consistent with identified statements.",
      };
    }

    if (crosscheck.consistencyIndex <= 40) {
      return {
        status: "red",
        summary: "Recent actions frequently diverge from identified statements.",
      };
    }

    return {
      status: "mixed",
      summary: "Live evidence shows mixed alignment between rhetoric and action.",
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

    const systemPrompt = [
      "You are CivicScrutiny's neutral analysis engine.",
      "Do not fabricate missing facts.",
      "Use conservative confidence and uncertainty handling.",
      "Return strict JSON only.",
    ].join(" ");

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
            content: [{ type: "input_text", text: systemPrompt }],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `${options.instruction}\n\nPayload JSON:\n${JSON.stringify(options.payload)}`,
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

    const payload = (await response.json()) as OpenAiResponsesPayload;
    const text = this.extractOutputText(payload);
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

  private extractOutputText(payload: OpenAiResponsesPayload): string {
    if (typeof payload.output_text === "string" && payload.output_text.trim()) {
      return payload.output_text.trim();
    }

    return (
      payload.output
        ?.flatMap((entry) => entry.content ?? [])
        .find((item) => item.type === "output_text" && typeof item.text === "string")?.text ?? ""
    ).trim();
  }
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

function overlapTagScore(a: string[], b: string[]): number {
  const genericTags = new Set(["general_policy", "general policy", "public_policy", "public policy"]);
  const tagsA = new Set(
    a.map((item) => normalizeName(item)).filter((item) => Boolean(item) && !genericTags.has(item))
  );
  const tagsB = new Set(
    b.map((item) => normalizeName(item)).filter((item) => Boolean(item) && !genericTags.has(item))
  );
  if (tagsA.size === 0 || tagsB.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const tag of tagsA) {
    if (tagsB.has(tag)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(tagsA.size, tagsB.size);
}

function inferActionPosition(text: string): string {
  const normalized = normalizeName(text);
  if (/support|back|approve|pass|signed|introduce|sponsor/.test(normalized)) {
    return "YES";
  }
  if (/oppose|reject|block|veto|against|criticize/.test(normalized)) {
    return "NO";
  }
  return "UNKNOWN";
}

function topicToTag(topic: string): string {
  const normalized = normalizeName(topic).replace(/[^a-z0-9\s]/g, "").trim();
  if (!normalized) {
    return "public_policy";
  }
  return normalized.replace(/\s+/g, "_");
}

function augmentTagsWithTopic(tags: string[], text: string, topic: string): string[] {
  const base = [...new Set(tags.map((item) => normalizeName(item)).filter(Boolean))];
  const topicNormalized = normalizeName(topic);
  if (!topicNormalized || topicNormalized === "public policy") {
    return base.length > 0 ? base : ["general_policy"];
  }

  const topicTokens = topicNormalized.split(" ").filter((token) => token.length > 3);
  const textNormalized = normalizeName(text);
  const mentionsTopic = topicTokens.some((token) => textNormalized.includes(token));
  if (!mentionsTopic) {
    return base.length > 0 ? base : ["general_policy"];
  }

  return [...new Set([...base, topicToTag(topic)])];
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

  throw new Error("No JSON object detected");
}
