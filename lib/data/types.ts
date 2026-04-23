import type {
  RawBillRecord,
  RawDonorContributionRecord,
  RawFinancialDisclosureRecord,
  RawPoliticianRecord,
  RawStatementRecord,
  RawVoteRecord
} from "@/lib/scrapers/types";
import type { Prisma } from "@prisma/client";

export interface TraceMetadata {
  sourceType: string;
  sourceUrl?: string;
  retrievalDate: Date;
  parserVersion: string;
  extractionStatus: "SUCCESS" | "PARTIAL" | "FAILED" | "PENDING";
  confidenceScore: number;
  verificationState: "VERIFIED" | "UNVERIFIED" | "NEEDS_VERIFICATION";
  rawTextSnapshot?: string;
  rawJsonSnapshot?: Prisma.InputJsonValue;
  notes?: string;
}

export interface NormalizedPolitician {
  externalId: string;
  slug: string;
  fullName: string;
  normalizedFullName: string;
  aliases: string[];
  party?: string;
  officeTitle: string;
  chamber?: string;
  jurisdictionLevel: "NATIONAL" | "STATE" | "LOCAL";
  jurisdictionState?: string;
  city?: string;
  county?: string;
  districtLabel?: string;
  candidateStatus: "CANDIDATE" | "OFFICEHOLDER" | "FORMER_OFFICEHOLDER";
  incumbentChallengerStatus: "INCUMBENT" | "CHALLENGER" | "OPEN_SEAT" | "UNKNOWN";
  officeSought?: string;
  electionYear?: number;
  issueFocusTags: string[];
  latestActivityAt?: Date;
  latestActivitySummary?: string;
  sourceLabel?: string;
  sourceUrl?: string;
  trace: TraceMetadata;
  raw: RawPoliticianRecord;
}

export interface NormalizedBill {
  externalId: string;
  billCode: string;
  title: string;
  summary: string;
  issueTags: string[];
  jurisdictionLevel: "NATIONAL" | "STATE" | "LOCAL";
  jurisdictionState?: string;
  chamber?: string;
  introducedAt?: Date;
  latestActionAt?: Date;
  sourceUrl?: string;
  trace: TraceMetadata;
  raw: RawBillRecord;
}

export interface NormalizedStatement {
  externalId: string;
  politicianExternalId: string;
  text: string;
  issueTags: string[];
  sourceType: "OTHER";
  sourceUrl?: string;
  sourceLabel?: string;
  madeAt: Date;
  trace: TraceMetadata;
  raw: RawStatementRecord;
}

export interface NormalizedVote {
  externalId: string;
  politicianExternalId: string;
  billCode: string;
  votePosition: "YES" | "NO" | "ABSTAIN" | "PRESENT" | "NOT_VOTING";
  rollCallReference?: string;
  votedAt: Date;
  sourceUrl?: string;
  trace: TraceMetadata;
  raw: RawVoteRecord;
}

export interface NormalizedDonorContribution {
  donorExternalId: string;
  donorName: string;
  donorType: "INDIVIDUAL" | "PAC" | "INDUSTRY" | "ASSOCIATION" | "NONPROFIT" | "OTHER";
  sector?: string;
  contributionExternalId: string;
  politicianExternalId: string;
  amountUsd: number;
  electionCycle: string;
  contributionDate: Date;
  contributionType?: string;
  sourceSystem: string;
  sourceUrl?: string;
  trace: TraceMetadata;
  raw: RawDonorContributionRecord;
}

export interface NormalizedFinancialDisclosure {
  externalId: string;
  politicianExternalId: string;
  filingYear: number;
  reportType: string;
  sourceUrl?: string;
  rawPdfPath?: string;
  filedAt?: Date;
  extractionStatus: "PENDING";
  trace: TraceMetadata;
  raw: RawFinancialDisclosureRecord;
}

export interface NormalizedPayload {
  politicians: NormalizedPolitician[];
  bills: NormalizedBill[];
  statements: NormalizedStatement[];
  votes: NormalizedVote[];
  donorContributions: NormalizedDonorContribution[];
  financialDisclosures: NormalizedFinancialDisclosure[];
}

export interface DatabaseReadyBatch {
  politicians: Omit<NormalizedPolitician, "raw">[];
  bills: Omit<NormalizedBill, "raw">[];
  statements: Omit<NormalizedStatement, "raw">[];
  votes: Omit<NormalizedVote, "raw">[];
  donorContributions: Omit<NormalizedDonorContribution, "raw">[];
  financialDisclosures: Omit<NormalizedFinancialDisclosure, "raw">[];
}
