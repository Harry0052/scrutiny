export type Classification = "aligned" | "contradicted" | "unclear";

export interface StatementVoteResult {
  statement_id: string;
  bill_id: string;
  classification: Classification;
  confidence_score: number;
  rationale: string;
}

export interface DashboardMethodology {
  version: string;
  honesty_score_formula: string;
  notes: string[];
}

export interface DashboardSummary {
  consistentActions: number;
  totalComparableStatements: number;
  honestyScore: number;
}
