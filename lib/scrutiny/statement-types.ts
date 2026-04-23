export type AnalysisModule =
  | "identity"
  | "sources"
  | "statements"
  | "actions"
  | "analysis"
  | "verdict";

export type AnalysisModuleState = "idle" | "loading" | "done" | "error";

export type SourceType =
  | "speech"
  | "interview"
  | "debate"
  | "press_release"
  | "hearing"
  | "article"
  | "official_bio"
  | "campaign_site"
  | "directory";

export type QuoteRelation = "supports" | "partially_conflicts" | "contradicts" | "unclear";

export type ConfidenceLabel = "High" | "Medium" | "Low";

export interface SourceLink {
  label: string;
  url: string;
  sourceType?: SourceType;
  reliabilityTier?: 1 | 2 | 3 | 4;
}

export interface PoliticianProfile {
  query: string;
  name: string;
  currentTitle: string;
  currentRole: string;
  party?: string | null;
  state?: string | null;
  politicalCareerStart?: string;
  summary: string;
  officialSite?: string;
  campaignSite?: string;
  socials: string[];
  sourceLinks: SourceLink[];
}

export interface SourceDocument {
  id: string;
  title: string;
  snippet: string;
  url: string;
  publishedAt?: string;
  domain: string;
  sourceType: SourceType;
  reliabilityTier: 1 | 2 | 3 | 4;
  retrievalDate: string;
}

export interface QuoteEvidence {
  id: string;
  quote: string;
  speaker: string;
  date?: string;
  sourceName: string;
  sourceUrl: string;
  sourceType: SourceType;
  reliabilityTier: 1 | 2 | 3 | 4;
  relation?: QuoteRelation;
  rationale?: string;
}

export interface ActionItem {
  id: string;
  title: string;
  position: string;
  description?: string;
  actionDate?: string;
  sourceUrl?: string;
  issueTags: string[];
}

export interface ScoreBreakdown {
  consistencyScore: number;
  factAlignmentScore: number;
  sourceReliabilityScore: number;
  contextCompletenessScore: number;
  rhetoricScore: number;
  weights: {
    consistency: number;
    factAlignment: number;
    sourceReliability: number;
    contextCompleteness: number;
    rhetoric: number;
  };
}

export interface ScrutinyBreakdown {
  finalScore: number;
  confidence: ConfidenceLabel;
  breakdown: ScoreBreakdown;
  explanation: string;
  limitations: string[];
  evidenceStats: {
    comparedQuotes: number;
    supportingQuotes: number;
    contradictoryQuotes: number;
    strongSourceQuotes: number;
    sourcesUsed: number;
  };
}

export interface StatementAnalysisResult {
  selectedStatement: string;
  statementCard: QuoteEvidence;
  scoreBand: "highly_misleading" | "questionable" | "mixed_reliability" | "mostly_consistent" | "highly_consistent";
  scrutiny: ScrutinyBreakdown;
  statementsCompared: QuoteEvidence[];
  supportingEvidence: QuoteEvidence[];
  contradictoryEvidence: QuoteEvidence[];
  relatedStatements: QuoteEvidence[];
  sources: SourceLink[];
}

export interface LiveAnalysisReport {
  profile: PoliticianProfile;
  topic: string;
  quotes: QuoteEvidence[];
  actions: ActionItem[];
  analysis: StatementAnalysisResult;
  generatedAt: string;
  methodology: string[];
}

export interface LiveAnalysisStreamEvent {
  type: "module" | "final" | "error";
  module?: AnalysisModule;
  state?: AnalysisModuleState;
  data?: unknown;
  message?: string;
}
