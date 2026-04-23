export type SourceName =
  | "official_house"
  | "official_senate"
  | "fec"
  | "openstates"
  | "propublica"
  | "google_civic"
  | "opensecrets"
  | "state_local"
  | "google_custom_search";

export type ProviderStatus = "ok" | "partial" | "error" | "unconfigured";

export type ProviderTrustTier = "OFFICIAL" | "OFFICIAL_AGGREGATOR" | "PUBLIC_AGGREGATOR";

export interface FetchWindow {
  startDate?: string;
  endDate?: string;
  jurisdiction?: "NATIONAL" | "STATE" | "LOCAL";
  stateCode?: string;
  query?: string;
  address?: string;
  maxRecords?: number;
  electionYear?: number;
  includeHistorical?: boolean;
}

export interface ConnectorFetchResult<TRecord> {
  source: SourceName;
  records: TRecord[];
  fetchedAt: string;
  status: ProviderStatus;
  note: string;
}

export interface RawPoliticianRecord {
  source: SourceName;
  sourceRecordId: string;
  fullName: string;
  normalizedFullName?: string;
  aliases?: string[];
  party?: string;
  officeTitle: string;
  chamber?: string;
  jurisdictionLevel: "NATIONAL" | "STATE" | "LOCAL";
  jurisdictionState?: string;
  city?: string;
  county?: string;
  districtLabel?: string;
  candidateStatus: "CANDIDATE" | "OFFICEHOLDER" | "FORMER_OFFICEHOLDER";
  incumbentChallengerStatus?: "INCUMBENT" | "CHALLENGER" | "OPEN_SEAT" | "UNKNOWN";
  officeSought?: string;
  electionYear?: number;
  issueFocusTags?: string[];
  latestActivityAt?: string;
  latestActivitySummary?: string;
  sourceUrl?: string;
  sourceLabel?: string;
}

export interface RawStatementRecord {
  source: SourceName;
  sourceRecordId: string;
  politicianExternalId: string;
  text: string;
  issueTags: string[];
  sourceUrl?: string;
  sourceLabel?: string;
  madeAt: string;
}

export interface RawBillRecord {
  source: SourceName;
  sourceRecordId: string;
  billCode: string;
  title: string;
  summary: string;
  issueTags: string[];
  jurisdictionLevel: "NATIONAL" | "STATE" | "LOCAL";
  jurisdictionState?: string;
  chamber?: string;
  introducedAt?: string;
  latestActionAt?: string;
  sourceUrl?: string;
}

export interface RawVoteRecord {
  source: SourceName;
  sourceRecordId: string;
  politicianExternalId: string;
  billCode: string;
  votePosition: "YES" | "NO" | "ABSTAIN" | "PRESENT" | "NOT_VOTING";
  rollCallReference?: string;
  votedAt: string;
  sourceUrl?: string;
}

export interface RawDonorContributionRecord {
  source: SourceName;
  sourceRecordId: string;
  donorExternalId: string;
  donorName: string;
  donorType: "INDIVIDUAL" | "PAC" | "INDUSTRY" | "ASSOCIATION" | "NONPROFIT" | "OTHER";
  sector?: string;
  politicianExternalId: string;
  amountUsd: number;
  electionCycle: string;
  contributionDate: string;
  contributionType?: string;
  sourceUrl?: string;
}

export interface RawFinancialDisclosureRecord {
  source: SourceName;
  sourceRecordId: string;
  politicianExternalId: string;
  filingYear: number;
  reportType: string;
  sourceUrl?: string;
  rawPdfPath?: string;
  filedAt?: string;
}

export interface SourcePayload {
  politicians: RawPoliticianRecord[];
  statements: RawStatementRecord[];
  bills: RawBillRecord[];
  votes: RawVoteRecord[];
  donorContributions: RawDonorContributionRecord[];
  financialDisclosures: RawFinancialDisclosureRecord[];
}

export interface ProviderResult {
  providerId: string;
  source: SourceName;
  priority: number;
  trustTier: ProviderTrustTier;
  fetchedAt: string;
  status: ProviderStatus;
  note: string;
  payload: SourcePayload;
}

export interface CivicDataProvider {
  readonly id: string;
  readonly source: SourceName;
  readonly priority: number;
  readonly trustTier: ProviderTrustTier;
  isConfigured(): boolean;
  fetch(window?: FetchWindow): Promise<ProviderResult>;
}
