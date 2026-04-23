import {
  AlignmentClassification,
  DisclosureExtractionStatus,
  ImpactAlignment,
  VotePosition
} from "@prisma/client";

import { calculateHonestyScore } from "@/lib/scoring";
import { prisma } from "@/lib/prisma";
import type { Classification, DashboardMethodology, StatementVoteResult } from "@/lib/types";

function toClassification(input: AlignmentClassification): Classification {
  if (input === "ALIGNED") {
    return "aligned";
  }
  if (input === "CONTRADICTED") {
    return "contradicted";
  }
  return "unclear";
}

function votePositionToSignal(votePosition: VotePosition): "supports" | "opposes" | "neutral" {
  if (votePosition === "YES") {
    return "supports";
  }

  if (votePosition === "NO") {
    return "opposes";
  }

  return "neutral";
}

function impactToLabel(input: ImpactAlignment): string {
  if (input === "ALIGNED") {
    return "Aligned with district indicators";
  }
  if (input === "PARTIAL") {
    return "Partially aligned with district indicators";
  }
  if (input === "MISALIGNED") {
    return "Misaligned with district indicators";
  }
  return "Insufficient district data";
}

function extractionStatusLabel(status: DisclosureExtractionStatus): string {
  if (status === "PARSED") {
    return "Parsed";
  }
  if (status === "PARTIAL") {
    return "Partially parsed";
  }
  if (status === "FAILED") {
    return "Failed";
  }
  return "Pending";
}

export const methodology: DashboardMethodology = {
  version: "truth-engine-0.1.0",
  honesty_score_formula: "(Consistent_Actions / Total_Comparable_Statements) * 100",
  notes: [
    "Only statements linked to a bill and a known vote are considered comparable.",
    "Consistent action count includes only classifications marked aligned.",
    "Unclear classifications are included in comparable totals but not in consistent actions.",
    "Confidence scores represent model certainty based on tag overlap and vote direction match."
  ]
};

export function isDatabaseConfigured(): boolean {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return false;
  }

  if (databaseUrl.includes("<project-ref>") || databaseUrl.includes("<db-password>")) {
    return false;
  }

  return databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://");
}

export async function getDashboardData(slug?: string) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  let politician;
  try {
    politician = await prisma.politician.findFirst({
      where: slug ? { slug } : undefined,
      orderBy: { createdAt: "asc" },
      include: {
        district: {
          include: {
            issueIndicators: true
          }
        },
        statements: {
          orderBy: { madeAt: "desc" },
          include: {
            candidateLinks: {
              include: {
                bill: true
              }
            }
          }
        },
        votes: {
          orderBy: { votedAt: "desc" },
          include: {
            bill: true
          }
        },
        donorContributions: {
          include: {
            donor: true
          },
          orderBy: { contributionDate: "desc" }
        },
        financialDisclosures: {
          orderBy: { filingYear: "desc" },
          include: {
            assets: true,
            liabilities: true,
            incomeSources: true,
            transactions: true
          }
        },
        analysisResults: {
          orderBy: { createdAt: "desc" },
          include: {
            statement: true,
            bill: true,
            vote: {
              include: {
                bill: true
              }
            }
          }
        },
        constituentImpactResults: {
          orderBy: { createdAt: "desc" },
          include: {
            bill: true,
            vote: true
          }
        }
      }
    });
  } catch (error) {
    console.error("Dashboard data query failed:", error);
    return null;
  }

  if (!politician) {
    return null;
  }

  const politicianDirectory = await prisma.politician.findMany({
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      slug: true,
      fullName: true,
      party: true,
      officeTitle: true,
      chamber: true,
      jurisdictionState: true
    }
  });

  const analysisFeed = politician.analysisResults.map((result) => ({
    id: result.id,
    statementId: result.statementId,
    statementText: result.statement.text,
    statementDate: result.statement.madeAt,
    billId: result.billId,
    billCode: result.bill?.billCode ?? "Unlinked",
    billTitle: result.bill?.title ?? "No linked bill",
    billSummary: result.bill?.summary ?? null,
    issueTags: result.statement.issueTags,
    votePosition: result.vote?.votePosition,
    voteSignal: result.vote ? votePositionToSignal(result.vote.votePosition) : "neutral",
    voteRecordId: result.vote?.id ?? null,
    voteRollCallReference: result.vote?.rollCallReference ?? null,
    statementSourceUrl: result.statement.sourceUrl,
    statementSourceLabel: result.statement.sourceLabel,
    classification: toClassification(result.classification),
    confidenceScore: result.confidenceScore,
    rationale: result.rationale,
    comparable: result.comparable,
    methodVersion: result.methodVersion,
    metadata: result.metadata,
    verificationState: result.verificationState
  }));

  const comparable = analysisFeed.filter((item) => item.comparable);
  const consistentActions = comparable.filter((item) => item.classification === "aligned").length;
  const totalComparableStatements = comparable.length;
  const honestyScore = calculateHonestyScore(consistentActions, totalComparableStatements);

  const donorBySector = politician.donorContributions.reduce<Record<string, number>>((acc, contribution) => {
    const sector = contribution.donor.sector ?? "unknown";
    const value = Number(contribution.amountUsd);
    acc[sector] = (acc[sector] ?? 0) + value;
    return acc;
  }, {});

  const donorSummary = Object.entries(donorBySector)
    .map(([sector, amount]) => ({ sector, amountUsd: Number(amount.toFixed(2)) }))
    .sort((a, b) => b.amountUsd - a.amountUsd);

  const donorRecords = politician.donorContributions.map((contribution) => ({
    id: contribution.id,
    donorName: contribution.donor.name,
    donorType: contribution.donor.donorType,
    donorSector: contribution.donor.sector ?? "unknown",
    amountUsd: Number(contribution.amountUsd),
    contributionDate: contribution.contributionDate,
    electionCycle: contribution.electionCycle,
    contributionType: contribution.contributionType,
    sourceSystem: contribution.sourceSystem,
    sourceRecordId: contribution.externalId,
    donorRecordId: contribution.donor.id,
    verificationState: contribution.verificationState
  }));

  const latestDisclosure = politician.financialDisclosures[0] ?? null;
  const disclosureHistory = politician.financialDisclosures.map((disclosure) => ({
    id: disclosure.id,
    externalId: disclosure.externalId,
    filingYear: disclosure.filingYear,
    reportType: disclosure.reportType,
    sourceUrl: disclosure.sourceUrl,
    rawPdfPath: disclosure.rawPdfPath,
    extractionStatus: extractionStatusLabel(disclosure.extractionStatus),
    extractionConfidence: disclosure.extractionConfidence,
    parserVersion: disclosure.parserVersion,
    filedAt: disclosure.filedAt,
    verificationState: disclosure.verificationState,
    assets: disclosure.assets,
    liabilities: disclosure.liabilities,
    incomeSources: disclosure.incomeSources,
    transactions: disclosure.transactions
  }));

  const wealthSummary = latestDisclosure
    ? {
        id: latestDisclosure.id,
        externalId: latestDisclosure.externalId,
        filingYear: latestDisclosure.filingYear,
        reportType: latestDisclosure.reportType,
        sourceUrl: latestDisclosure.sourceUrl,
        rawPdfPath: latestDisclosure.rawPdfPath,
        extractionStatus: extractionStatusLabel(latestDisclosure.extractionStatus),
        extractionConfidence: latestDisclosure.extractionConfidence,
        parserVersion: latestDisclosure.parserVersion,
        filedAt: latestDisclosure.filedAt,
        verificationState: latestDisclosure.verificationState,
        assets: latestDisclosure.assets,
        liabilities: latestDisclosure.liabilities,
        incomeSources: latestDisclosure.incomeSources,
        transactions: latestDisclosure.transactions
      }
    : null;

  const constituentImpact = politician.constituentImpactResults.map((impact) => ({
    id: impact.id,
    billId: impact.billId,
    voteId: impact.voteId,
    billCode: impact.bill.billCode,
    billTitle: impact.bill.title,
    issueTag: impact.issueTag,
    alignment: impactToLabel(impact.impactAlignment),
    impactScore: impact.impactScore,
    confidenceScore: impact.confidenceScore,
    rationale: impact.rationale
  }));

  const timeline = politician.statements.map((statement) => ({
    id: statement.id,
    madeAt: statement.madeAt,
    sourceType: statement.sourceType,
    sourceLabel: statement.sourceLabel,
    sourceUrl: statement.sourceUrl,
    issueTags: statement.issueTags,
    text: statement.text,
    verificationState: statement.verificationState,
    linkedBills: statement.candidateLinks.map((link) => ({
      billId: link.bill.id,
      billCode: link.bill.billCode,
      billTitle: link.bill.title,
      relevanceScore: link.relevanceScore,
      relevanceRationale: link.relevanceRationale
    }))
  }));

  const voteTimeline = politician.votes.map((vote) => ({
    id: vote.id,
    billId: vote.billId,
    billCode: vote.bill.billCode,
    billTitle: vote.bill.title,
    issueTags: vote.bill.issueTags,
    votePosition: vote.votePosition,
    rollCallReference: vote.rollCallReference,
    votedAt: vote.votedAt,
    verificationState: vote.verificationState
  }));

  const evidenceFeed = analysisFeed.map((analysis) => ({
    id: `analysis-${analysis.id}`,
    type: "analysis_result" as const,
    title: `${analysis.classification.toUpperCase()} - ${analysis.billCode}`,
    occurredAt: analysis.statementDate,
    confidenceScore: analysis.confidenceScore,
    summary: analysis.rationale,
    sourceReferences: [
      {
        label: analysis.statementSourceLabel ?? "Statement source",
        url: analysis.statementSourceUrl
      }
    ],
    relatedRecordIds: {
      analysisId: analysis.id,
      statementId: analysis.statementId,
      billId: analysis.billId,
      voteId: analysis.voteRecordId
    }
  }));

  const statementVoteResults: StatementVoteResult[] = comparable.map((item) => ({
    statement_id: item.statementId,
    bill_id: item.billId ?? "",
    classification: item.classification,
    confidence_score: item.confidenceScore,
    rationale: item.rationale
  }));

  const lineageRecordIds = [
    ...politician.analysisResults.map((item) => item.id),
    ...politician.statements.map((item) => item.id),
    ...politician.votes.map((item) => item.id),
    ...politician.donorContributions.map((item) => item.id),
    ...politician.financialDisclosures.map((item) => item.id)
  ];

  const lineage = await prisma.dataLineage.findMany({
    where: {
      recordId: { in: lineageRecordIds }
    },
    orderBy: { createdAt: "desc" }
  });

  const lineageByRecord = lineage.reduce<Record<string, typeof lineage>>((acc, row) => {
    if (!acc[row.recordId]) {
      acc[row.recordId] = [];
    }
    acc[row.recordId].push(row);
    return acc;
  }, {});

  return {
    politician: {
      id: politician.id,
      slug: politician.slug,
      fullName: politician.fullName,
      party: politician.party,
      officeTitle: politician.officeTitle,
      chamber: politician.chamber,
      jurisdictionLevel: politician.jurisdictionLevel,
      jurisdictionState: politician.jurisdictionState,
      districtLabel: politician.districtLabel,
      district: politician.district
    },
    politicianDirectory,
    summary: {
      consistentActions,
      totalComparableStatements,
      honestyScore
    },
    statementTimeline: timeline,
    voteTimeline,
    statementVoteFeed: analysisFeed,
    statementVoteResults,
    donorSummary,
    donorRecords,
    wealthSummary,
    disclosureHistory,
    constituentImpact,
    evidenceFeed,
    trustSignals: {
      lineageCount: lineage.length,
      rawLayerRecords: lineage.filter((item) => item.layer === "RAW").length,
      normalizedLayerRecords: lineage.filter((item) => item.layer === "NORMALIZED").length,
      interpretedLayerRecords: lineage.filter((item) => item.layer === "INTERPRETED").length
    },
    lineageByRecord,
    methodology
  };
}

export async function getOverviewByPoliticianIdentifier(identifier: string) {
  const dashboardData = await getDashboardData(identifier);

  if (dashboardData) {
    return dashboardData;
  }

  const politicianById = await prisma.politician.findUnique({ where: { id: identifier } });
  if (!politicianById) {
    return null;
  }

  return getDashboardData(politicianById.slug);
}
