export type ScrutinyModule =
  | "identity"
  | "financials"
  | "legislative"
  | "statements"
  | "crosscheck"
  | "wealth"
  | "verdict";

export type ModuleState = "idle" | "loading" | "done" | "error";

export interface EvidenceLink {
  label: string;
  url: string;
}

export interface IdentityProfile {
  query: string;
  resolvedName: string;
  office: string;
  party?: string | null;
  state?: string | null;
  campaignWebsite?: string;
  officialWebsite?: string;
  socialHandles: string[];
  sourceLinks: EvidenceLink[];
}

export interface DonorRecord {
  donorName: string;
  donorType: string;
  sector?: string;
  totalAmountUsd: number;
  sourceUrl?: string;
}

export interface FinancialSnapshot {
  topDonors: DonorRecord[];
  totalTrackedUsd: number;
  sourceNotes: string[];
}

export interface LegislativeVote {
  voteId: string;
  votedAt?: string;
  billCode?: string;
  billTitle: string;
  description?: string;
  position: string;
  sourceUrl?: string;
  issueTags: string[];
}

export interface LegislativeSnapshot {
  votes: LegislativeVote[];
  sourceNotes: string[];
}

export interface StatementRecord {
  statementId: string;
  text: string;
  madeAt?: string;
  source: string;
  sourceUrl?: string;
  topicTags: string[];
}

export interface StatementSnapshot {
  statements: StatementRecord[];
  sourceNotes: string[];
}

export type CrosscheckClassification = "aligned" | "contradicted" | "unclear";

export interface StatementActionComparison {
  statementId: string;
  statementText: string;
  actionId: string;
  actionText: string;
  classification: CrosscheckClassification;
  confidenceScore: number;
  rationale: string;
  sourceLinks: string[];
}

export interface CrosscheckSnapshot {
  comparisons: StatementActionComparison[];
  consistentActions: number;
  totalStatements: number;
  consistencyIndex: number;
  sourceNotes: string[];
}

export interface WealthPoint {
  year: number;
  netWorthEstimateUsd: number;
  sourceUrl?: string;
}

export interface WealthSnapshot {
  disclosureLinks: EvidenceLink[];
  trend: WealthPoint[];
  sourceNotes: string[];
}

export interface DonorPolicyCorrelation {
  donorName: string;
  sector?: string;
  matchedActions: Array<{
    voteId: string;
    billTitle: string;
    matchReason: string;
  }>;
}

export interface VerdictSnapshot {
  status: "green" | "red" | "mixed";
  summary: string;
}

export interface ScrutinyReport {
  identity: IdentityProfile;
  financials: FinancialSnapshot;
  legislative: LegislativeSnapshot;
  statements: StatementSnapshot;
  crosscheck: CrosscheckSnapshot;
  wealth: WealthSnapshot;
  donorPolicyCorrelation: DonorPolicyCorrelation[];
  verdict: VerdictSnapshot;
  scrutinyScore: number;
  generatedAt: string;
  methodology: string[];
}

export interface ScrutinyStreamEvent {
  type: "module" | "final" | "error";
  module?: ScrutinyModule;
  state?: ModuleState;
  data?: unknown;
  message?: string;
}
