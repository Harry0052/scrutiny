import type { JurisdictionLevel, Prisma, VotePosition } from "@prisma/client";

import type { DatabaseReadyBatch } from "@/lib/data/types";
import { appendLineageEntry, logParserRun } from "@/lib/integrity/audit";
import { prisma } from "@/lib/prisma";
import { sourcePriority, sourceTrustDescription } from "@/lib/scrapers/source-priority";
import type { SourceName } from "@/lib/scrapers/types";

interface PersistSummary {
  politiciansUpserted: number;
  billsUpserted: number;
  statementsUpserted: number;
  votesUpserted: number;
  donorsUpserted: number;
  contributionsUpserted: number;
  disclosuresUpserted: number;
}

function toSourceName(value: string): SourceName | undefined {
  const allowed: SourceName[] = [
    "official_house",
    "official_senate",
    "fec",
    "openstates",
    "propublica",
    "google_civic",
    "opensecrets",
    "state_local"
  ];

  if (allowed.includes(value as SourceName)) {
    return value as SourceName;
  }

  return undefined;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function mergeJsonArray(existing: unknown, nextValue: string): string[] {
  const values = Array.isArray(existing) ? existing.filter((item): item is string => typeof item === "string") : [];
  return [...new Set([...values, nextValue])];
}

async function upsertSearchDocumentForPolitician(politicianId: string) {
  const politician = await prisma.politician.findUnique({
    where: { id: politicianId },
    include: {
      aliases: { select: { alias: true } }
    }
  });

  if (!politician) {
    return;
  }

  const donorAggregate = await prisma.donorContribution.aggregate({
    where: { politicianId },
    _sum: { amountUsd: true }
  });

  const recentVotesCount = await prisma.vote.count({
    where: {
      politicianId,
      votedAt: {
        gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      }
    }
  });

  const latestDisclosure = await prisma.financialDisclosure.findFirst({
    where: { politicianId },
    orderBy: { filingYear: "desc" },
    select: { filingYear: true }
  });

  const latestHonesty = await prisma.honestyScoreSnapshot.findFirst({
    where: { politicianId },
    orderBy: { createdAt: "desc" },
    select: { honestyScore: true }
  });

  const statementIssueTags = await prisma.statement.findMany({
    where: { politicianId },
    select: { issueTags: true },
    take: 50,
    orderBy: { madeAt: "desc" }
  });

  const combinedIssueTags = [
    ...new Set([
      ...politician.issueFocusTags,
      ...statementIssueTags.flatMap((row) => row.issueTags.map((tag) => tag.toLowerCase()))
    ])
  ];

  const officeDisplay = politician.officeSought ?? politician.officeTitle;
  const aliases = [...new Set(politician.aliases.map((alias) => alias.alias))];
  const searchBlob = [
    politician.fullName,
    politician.normalizedFullName ?? "",
    aliases.join(" "),
    politician.party ?? "",
    officeDisplay,
    politician.chamber ?? "",
    politician.city ?? "",
    politician.county ?? "",
    politician.jurisdictionState ?? "",
    politician.districtLabel ?? "",
    combinedIssueTags.join(" ")
  ]
    .join(" ")
    .toLowerCase();

  await prisma.publicFigureSearchDocument.upsert({
    where: { politicianId },
    update: {
      fullName: politician.fullName,
      normalizedFullName: politician.normalizedFullName ?? politician.fullName.toLowerCase(),
      aliases,
      officeDisplay,
      officeHeld: politician.officeTitle,
      officeSought: politician.officeSought,
      chamber: politician.chamber,
      party: politician.party,
      jurisdictionLevel: politician.jurisdictionLevel,
      jurisdictionState: politician.jurisdictionState,
      city: politician.city,
      county: politician.county,
      districtLabel: politician.districtLabel,
      candidateStatus: politician.candidateStatus,
      incumbentChallengerStatus: politician.incumbentChallengerStatus,
      electionYear: politician.electionYear,
      issueTags: combinedIssueTags,
      honestyScore: latestHonesty?.honestyScore,
      donorVolumeUsd: Number(donorAggregate._sum.amountUsd ?? 0),
      recentVotesCount,
      latestDisclosureYear: latestDisclosure?.filingYear,
      latestActivityAt: politician.latestActivityAt,
      latestActivitySummary: politician.latestActivitySummary,
      searchBlob
    },
    create: {
      politicianId,
      fullName: politician.fullName,
      normalizedFullName: politician.normalizedFullName ?? politician.fullName.toLowerCase(),
      aliases,
      officeDisplay,
      officeHeld: politician.officeTitle,
      officeSought: politician.officeSought,
      chamber: politician.chamber,
      party: politician.party,
      jurisdictionLevel: politician.jurisdictionLevel,
      jurisdictionState: politician.jurisdictionState,
      city: politician.city,
      county: politician.county,
      districtLabel: politician.districtLabel,
      candidateStatus: politician.candidateStatus,
      incumbentChallengerStatus: politician.incumbentChallengerStatus,
      electionYear: politician.electionYear,
      issueTags: combinedIssueTags,
      honestyScore: latestHonesty?.honestyScore,
      donorVolumeUsd: Number(donorAggregate._sum.amountUsd ?? 0),
      recentVotesCount,
      latestDisclosureYear: latestDisclosure?.filingYear,
      latestActivityAt: politician.latestActivityAt,
      latestActivitySummary: politician.latestActivitySummary,
      searchBlob
    }
  });
}

export async function persistDatabaseReadyBatch(batch: DatabaseReadyBatch): Promise<PersistSummary> {
  let politiciansUpserted = 0;
  let billsUpserted = 0;
  let statementsUpserted = 0;
  let votesUpserted = 0;
  let donorsUpserted = 0;
  let contributionsUpserted = 0;
  let disclosuresUpserted = 0;

  const billIdByCode = new Map<string, string>();
  const politicianIdByExternal = new Map<string, string>();
  const touchedPoliticianIds = new Set<string>();

  for (const politician of batch.politicians) {
    const existingByExternal = await prisma.politician.findUnique({ where: { externalId: politician.externalId } });
    const existingBySlug =
      existingByExternal ??
      (await prisma.politician.findUnique({ where: { slug: politician.slug } }));

    const source = toSourceName(politician.trace.sourceType);
    const incomingPriority = source ? sourcePriority(source) : 0;

    if (!existingBySlug) {
      const created = await prisma.politician.create({
        data: {
          externalId: politician.externalId,
          slug: politician.slug,
          fullName: politician.fullName,
          normalizedFullName: politician.normalizedFullName,
          party: politician.party,
          officeTitle: politician.officeTitle,
          chamber: politician.chamber,
          jurisdictionLevel: politician.jurisdictionLevel,
          jurisdictionState: politician.jurisdictionState,
          districtLabel: politician.districtLabel,
          city: politician.city,
          county: politician.county,
          candidateStatus: politician.candidateStatus,
          incumbentChallengerStatus: politician.incumbentChallengerStatus,
          officeSought: politician.officeSought,
          electionYear: politician.electionYear,
          issueFocusTags: politician.issueFocusTags,
          latestActivityAt: politician.latestActivityAt,
          latestActivitySummary: politician.latestActivitySummary,
          externalProfiles: {
            ingestion: {
              sourceType: politician.trace.sourceType,
              sourcePriority: incomingPriority,
              trustType: source ? sourceTrustDescription(source) : "unknown",
              retrievedAt: politician.trace.retrievalDate.toISOString()
            },
            sourceUrls: politician.sourceUrl ? [politician.sourceUrl] : []
          }
        }
      });

      politicianIdByExternal.set(politician.externalId, created.id);
      touchedPoliticianIds.add(created.id);
      politiciansUpserted += 1;

      await appendLineageEntry({
        recordType: "politician",
        recordId: created.id,
        layer: "RAW",
        sourceUrl: politician.trace.sourceUrl,
        sourceType: politician.trace.sourceType,
        retrievalDate: politician.trace.retrievalDate,
        parserVersion: politician.trace.parserVersion,
        extractionStatus: politician.trace.extractionStatus,
        confidenceScore: politician.trace.confidenceScore,
        verificationState: politician.trace.verificationState,
        rawJsonSnapshot: politician.trace.rawJsonSnapshot,
        notes: politician.trace.notes
      });
    } else {
      const existingProfiles = asObject(existingBySlug.externalProfiles);
      const existingIngestion = asObject(existingProfiles.ingestion);
      const existingSourceType =
        typeof existingIngestion.sourceType === "string" ? existingIngestion.sourceType : undefined;
      const existingTrustType =
        typeof existingIngestion.trustType === "string" ? existingIngestion.trustType : undefined;
      const existingPriority =
        typeof existingIngestion.sourcePriority === "number" ? existingIngestion.sourcePriority : 0;
      const shouldOverride = incomingPriority >= existingPriority;

      const mergedIssueTags = [...new Set([...(existingBySlug.issueFocusTags ?? []), ...politician.issueFocusTags])];

      const updatePayload: Parameters<typeof prisma.politician.update>[0]["data"] = {
        issueFocusTags: mergedIssueTags,
        latestActivityAt:
          shouldOverride || !existingBySlug.latestActivityAt
            ? (politician.latestActivityAt ?? existingBySlug.latestActivityAt)
            : existingBySlug.latestActivityAt,
        latestActivitySummary:
          shouldOverride || !existingBySlug.latestActivitySummary
            ? (politician.latestActivitySummary ?? existingBySlug.latestActivitySummary)
            : existingBySlug.latestActivitySummary,
        externalProfiles: {
          ...existingProfiles,
          ingestion: {
            sourceType: shouldOverride ? politician.trace.sourceType : existingSourceType,
            sourcePriority: Math.max(existingPriority, incomingPriority),
            trustType: source ? sourceTrustDescription(source) : existingTrustType,
            retrievedAt: politician.trace.retrievalDate.toISOString()
          },
          sourceUrls: politician.sourceUrl
            ? mergeJsonArray(existingProfiles.sourceUrls, politician.sourceUrl)
            : mergeJsonArray(existingProfiles.sourceUrls, "")
                .filter(Boolean)
        } as Prisma.InputJsonValue
      };

      if (shouldOverride) {
        updatePayload.fullName = politician.fullName;
        updatePayload.normalizedFullName = politician.normalizedFullName;
        updatePayload.party = politician.party;
        updatePayload.officeTitle = politician.officeTitle;
        updatePayload.chamber = politician.chamber;
        updatePayload.jurisdictionLevel = politician.jurisdictionLevel;
        updatePayload.jurisdictionState = politician.jurisdictionState;
        updatePayload.districtLabel = politician.districtLabel;
        updatePayload.city = politician.city;
        updatePayload.county = politician.county;
        updatePayload.candidateStatus = politician.candidateStatus;
        updatePayload.incumbentChallengerStatus = politician.incumbentChallengerStatus;
        updatePayload.officeSought = politician.officeSought;
        updatePayload.electionYear = politician.electionYear;
      }

      const updated = await prisma.politician.update({
        where: { id: existingBySlug.id },
        data: updatePayload
      });

      if (!updated.externalId) {
        await prisma.politician.update({
          where: { id: updated.id },
          data: { externalId: politician.externalId }
        });
      }

      politicianIdByExternal.set(politician.externalId, updated.id);
      touchedPoliticianIds.add(updated.id);
      politiciansUpserted += 1;

      await appendLineageEntry({
        recordType: "politician",
        recordId: updated.id,
        layer: "NORMALIZED",
        sourceUrl: politician.trace.sourceUrl,
        sourceType: politician.trace.sourceType,
        retrievalDate: politician.trace.retrievalDate,
        parserVersion: politician.trace.parserVersion,
        extractionStatus: "SUCCESS",
        confidenceScore: politician.trace.confidenceScore,
        verificationState: politician.trace.verificationState,
        rawJsonSnapshot: {
          fullName: politician.fullName,
          officeTitle: politician.officeTitle,
          jurisdictionState: politician.jurisdictionState,
          candidateStatus: politician.candidateStatus
        },
        notes: "Politician record merged using source priority rules"
      });
    }

    const politicianId =
      politicianIdByExternal.get(politician.externalId) ??
      (await prisma.politician.findUnique({ where: { externalId: politician.externalId }, select: { id: true } }))?.id;

    if (!politicianId) {
      continue;
    }

    for (const alias of politician.aliases) {
      const normalizedAlias = alias.toLowerCase().trim();
      if (!normalizedAlias) {
        continue;
      }

      const existingAlias = await prisma.politicianAlias.findFirst({
        where: {
          politicianId,
          normalizedAlias
        }
      });

      if (!existingAlias) {
        await prisma.politicianAlias.create({
          data: {
            politicianId,
            alias,
            normalizedAlias
          }
        });
      }
    }

    const existingOfficeHistory = await prisma.officeHistory.findFirst({
      where: {
        politicianId,
        officeTitle: politician.officeTitle,
        jurisdictionLevel: politician.jurisdictionLevel,
        jurisdictionState: politician.jurisdictionState,
        districtLabel: politician.districtLabel,
        isCurrent: politician.candidateStatus === "OFFICEHOLDER"
      }
    });

    if (!existingOfficeHistory) {
      await prisma.officeHistory.create({
        data: {
          politicianId,
          officeTitle: politician.officeTitle,
          chamber: politician.chamber,
          jurisdictionLevel: politician.jurisdictionLevel,
          jurisdictionState: politician.jurisdictionState,
          city: politician.city,
          county: politician.county,
          districtLabel: politician.districtLabel,
          isCurrent: politician.candidateStatus === "OFFICEHOLDER",
          electionYear: politician.electionYear
        }
      });
    }
  }

  for (const bill of batch.bills) {
    const upserted = await prisma.bill.upsert({
      where: { billCode: bill.billCode },
      update: {
        title: bill.title,
        summary: bill.summary,
        issueTags: bill.issueTags,
        jurisdictionLevel: bill.jurisdictionLevel as JurisdictionLevel,
        jurisdictionState: bill.jurisdictionState,
        chamber: bill.chamber,
        introducedAt: bill.introducedAt,
        latestActionAt: bill.latestActionAt,
        sourceRetrievedAt: bill.trace.retrievalDate,
        parserVersion: bill.trace.parserVersion,
        extractionConfidence: bill.trace.confidenceScore,
        verificationState: bill.trace.verificationState,
        rawSourceSnapshot: bill.trace.rawJsonSnapshot as object | undefined
      },
      create: {
        externalId: bill.externalId,
        billCode: bill.billCode,
        title: bill.title,
        summary: bill.summary,
        issueTags: bill.issueTags,
        jurisdictionLevel: bill.jurisdictionLevel as JurisdictionLevel,
        jurisdictionState: bill.jurisdictionState,
        chamber: bill.chamber,
        introducedAt: bill.introducedAt,
        latestActionAt: bill.latestActionAt,
        sourceRetrievedAt: bill.trace.retrievalDate,
        parserVersion: bill.trace.parserVersion,
        extractionConfidence: bill.trace.confidenceScore,
        verificationState: bill.trace.verificationState,
        rawSourceSnapshot: bill.trace.rawJsonSnapshot as object | undefined
      }
    });

    await appendLineageEntry({
      recordType: "bill",
      recordId: upserted.id,
      layer: "RAW",
      sourceUrl: bill.trace.sourceUrl,
      sourceType: bill.trace.sourceType,
      retrievalDate: bill.trace.retrievalDate,
      parserVersion: bill.trace.parserVersion,
      extractionStatus: bill.trace.extractionStatus,
      confidenceScore: bill.trace.confidenceScore,
      verificationState: bill.trace.verificationState,
      rawJsonSnapshot: bill.trace.rawJsonSnapshot,
      notes: bill.trace.notes
    });

    billIdByCode.set(bill.billCode, upserted.id);
    billsUpserted += 1;
  }

  for (const statement of batch.statements) {
    let politicianId = politicianIdByExternal.get(statement.politicianExternalId);
    if (!politicianId) {
      politicianId = (
        await prisma.politician.findUnique({
          where: { externalId: statement.politicianExternalId },
          select: { id: true }
        })
      )?.id;
    }

    if (!politicianId) {
      continue;
    }

    politicianIdByExternal.set(statement.politicianExternalId, politicianId);
    touchedPoliticianIds.add(politicianId);

    const upserted = await prisma.statement.upsert({
      where: { externalId: statement.externalId },
      update: {
        politicianId,
        text: statement.text,
        issueTags: statement.issueTags,
        sourceType: statement.sourceType,
        sourceUrl: statement.sourceUrl,
        sourceLabel: statement.sourceLabel,
        madeAt: statement.madeAt,
        sourceRetrievedAt: statement.trace.retrievalDate,
        parserVersion: statement.trace.parserVersion,
        extractionConfidence: statement.trace.confidenceScore,
        verificationState: statement.trace.verificationState,
        rawSourceSnapshot: statement.trace.rawJsonSnapshot as object | undefined
      },
      create: {
        externalId: statement.externalId,
        politicianId,
        text: statement.text,
        issueTags: statement.issueTags,
        sourceType: statement.sourceType,
        sourceUrl: statement.sourceUrl,
        sourceLabel: statement.sourceLabel,
        madeAt: statement.madeAt,
        sourceRetrievedAt: statement.trace.retrievalDate,
        parserVersion: statement.trace.parserVersion,
        extractionConfidence: statement.trace.confidenceScore,
        verificationState: statement.trace.verificationState,
        rawSourceSnapshot: statement.trace.rawJsonSnapshot as object | undefined
      }
    });

    await appendLineageEntry({
      recordType: "statement",
      recordId: upserted.id,
      layer: "RAW",
      sourceUrl: statement.trace.sourceUrl,
      sourceType: statement.trace.sourceType,
      retrievalDate: statement.trace.retrievalDate,
      parserVersion: statement.trace.parserVersion,
      extractionStatus: statement.trace.extractionStatus,
      confidenceScore: statement.trace.confidenceScore,
      verificationState: statement.trace.verificationState,
      rawTextSnapshot: statement.trace.rawTextSnapshot,
      rawJsonSnapshot: statement.trace.rawJsonSnapshot,
      notes: statement.trace.notes
    });

    statementsUpserted += 1;
  }

  for (const vote of batch.votes) {
    const politicianId =
      politicianIdByExternal.get(vote.politicianExternalId) ??
      (
        await prisma.politician.findUnique({
          where: { externalId: vote.politicianExternalId },
          select: { id: true }
        })
      )?.id;

    const billId = billIdByCode.get(vote.billCode);
    if (!politicianId || !billId) {
      continue;
    }

    touchedPoliticianIds.add(politicianId);

    const upserted = await prisma.vote.upsert({
      where: { externalId: vote.externalId },
      update: {
        politicianId,
        billId,
        votePosition: vote.votePosition as VotePosition,
        rollCallReference: vote.rollCallReference,
        votedAt: vote.votedAt,
        sourceRetrievedAt: vote.trace.retrievalDate,
        parserVersion: vote.trace.parserVersion,
        extractionConfidence: vote.trace.confidenceScore,
        verificationState: vote.trace.verificationState,
        rawSourceSnapshot: vote.trace.rawJsonSnapshot as object | undefined
      },
      create: {
        externalId: vote.externalId,
        politicianId,
        billId,
        votePosition: vote.votePosition as VotePosition,
        rollCallReference: vote.rollCallReference,
        votedAt: vote.votedAt,
        sourceRetrievedAt: vote.trace.retrievalDate,
        parserVersion: vote.trace.parserVersion,
        extractionConfidence: vote.trace.confidenceScore,
        verificationState: vote.trace.verificationState,
        rawSourceSnapshot: vote.trace.rawJsonSnapshot as object | undefined
      }
    });

    await appendLineageEntry({
      recordType: "vote",
      recordId: upserted.id,
      layer: "RAW",
      sourceType: vote.trace.sourceType,
      sourceUrl: vote.trace.sourceUrl,
      retrievalDate: vote.trace.retrievalDate,
      parserVersion: vote.trace.parserVersion,
      extractionStatus: vote.trace.extractionStatus,
      confidenceScore: vote.trace.confidenceScore,
      verificationState: vote.trace.verificationState,
      rawJsonSnapshot: vote.trace.rawJsonSnapshot,
      notes: vote.trace.notes
    });

    votesUpserted += 1;
  }

  for (const contribution of batch.donorContributions) {
    const politicianId =
      politicianIdByExternal.get(contribution.politicianExternalId) ??
      (
        await prisma.politician.findUnique({
          where: { externalId: contribution.politicianExternalId },
          select: { id: true }
        })
      )?.id;

    if (!politicianId) {
      continue;
    }

    touchedPoliticianIds.add(politicianId);

    const donor = await prisma.donor.upsert({
      where: { externalId: contribution.donorExternalId },
      update: {
        name: contribution.donorName,
        donorType: contribution.donorType,
        sector: contribution.sector
      },
      create: {
        externalId: contribution.donorExternalId,
        name: contribution.donorName,
        donorType: contribution.donorType,
        sector: contribution.sector
      }
    });

    donorsUpserted += 1;

    const upserted = await prisma.donorContribution.upsert({
      where: { externalId: contribution.contributionExternalId },
      update: {
        donorId: donor.id,
        politicianId,
        amountUsd: contribution.amountUsd,
        electionCycle: contribution.electionCycle,
        contributionDate: contribution.contributionDate,
        contributionType: contribution.contributionType,
        sourceSystem: contribution.sourceSystem,
        sourceRetrievedAt: contribution.trace.retrievalDate,
        parserVersion: contribution.trace.parserVersion,
        extractionConfidence: contribution.trace.confidenceScore,
        verificationState: contribution.trace.verificationState,
        rawSourceSnapshot: contribution.trace.rawJsonSnapshot as object | undefined
      },
      create: {
        externalId: contribution.contributionExternalId,
        donorId: donor.id,
        politicianId,
        amountUsd: contribution.amountUsd,
        electionCycle: contribution.electionCycle,
        contributionDate: contribution.contributionDate,
        contributionType: contribution.contributionType,
        sourceSystem: contribution.sourceSystem,
        sourceRetrievedAt: contribution.trace.retrievalDate,
        parserVersion: contribution.trace.parserVersion,
        extractionConfidence: contribution.trace.confidenceScore,
        verificationState: contribution.trace.verificationState,
        rawSourceSnapshot: contribution.trace.rawJsonSnapshot as object | undefined
      }
    });

    await appendLineageEntry({
      recordType: "donor_contribution",
      recordId: upserted.id,
      layer: "RAW",
      sourceType: contribution.trace.sourceType,
      sourceUrl: contribution.trace.sourceUrl,
      retrievalDate: contribution.trace.retrievalDate,
      parserVersion: contribution.trace.parserVersion,
      extractionStatus: contribution.trace.extractionStatus,
      confidenceScore: contribution.trace.confidenceScore,
      verificationState: contribution.trace.verificationState,
      rawJsonSnapshot: contribution.trace.rawJsonSnapshot,
      notes: contribution.trace.notes
    });

    contributionsUpserted += 1;
  }

  for (const disclosure of batch.financialDisclosures) {
    const politicianId =
      politicianIdByExternal.get(disclosure.politicianExternalId) ??
      (
        await prisma.politician.findUnique({
          where: { externalId: disclosure.politicianExternalId },
          select: { id: true }
        })
      )?.id;

    if (!politicianId) {
      continue;
    }

    touchedPoliticianIds.add(politicianId);

    const upserted = await prisma.financialDisclosure.upsert({
      where: { externalId: disclosure.externalId },
      update: {
        politicianId,
        filingYear: disclosure.filingYear,
        reportType: disclosure.reportType,
        sourceUrl: disclosure.sourceUrl,
        rawPdfPath: disclosure.rawPdfPath,
        filedAt: disclosure.filedAt,
        extractionStatus: disclosure.extractionStatus,
        sourceRetrievedAt: disclosure.trace.retrievalDate,
        parserVersion: disclosure.trace.parserVersion,
        extractionConfidence: disclosure.trace.confidenceScore,
        verificationState: disclosure.trace.verificationState
      },
      create: {
        externalId: disclosure.externalId,
        politicianId,
        filingYear: disclosure.filingYear,
        reportType: disclosure.reportType,
        sourceUrl: disclosure.sourceUrl,
        rawPdfPath: disclosure.rawPdfPath,
        filedAt: disclosure.filedAt,
        extractionStatus: disclosure.extractionStatus,
        sourceRetrievedAt: disclosure.trace.retrievalDate,
        parserVersion: disclosure.trace.parserVersion,
        extractionConfidence: disclosure.trace.confidenceScore,
        verificationState: disclosure.trace.verificationState
      }
    });

    await appendLineageEntry({
      recordType: "financial_disclosure",
      recordId: upserted.id,
      layer: "RAW",
      sourceUrl: disclosure.trace.sourceUrl,
      sourceType: disclosure.trace.sourceType,
      retrievalDate: disclosure.trace.retrievalDate,
      parserVersion: disclosure.trace.parserVersion,
      extractionStatus: disclosure.trace.extractionStatus,
      confidenceScore: disclosure.trace.confidenceScore,
      verificationState: disclosure.trace.verificationState,
      rawJsonSnapshot: disclosure.trace.rawJsonSnapshot,
      notes: disclosure.trace.notes
    });
    await logParserRun({
      sourceType: disclosure.trace.sourceType,
      sourceUrl: disclosure.trace.sourceUrl,
      parserVersion: disclosure.trace.parserVersion,
      status: "PARTIAL",
      confidenceScore: disclosure.trace.confidenceScore,
      recordType: "financial_disclosure",
      recordId: upserted.id,
      message: "Disclosure metadata ingested; full table extraction pending parser run.",
      rawInputSnapshot: disclosure.trace.rawJsonSnapshot,
      rawOutputSnapshot: {
        filingYear: disclosure.filingYear,
        reportType: disclosure.reportType,
        extractionStatus: disclosure.extractionStatus
      }
    });

    disclosuresUpserted += 1;
  }

  await Promise.all([...touchedPoliticianIds].map((politicianId) => upsertSearchDocumentForPolitician(politicianId)));

  return {
    politiciansUpserted,
    billsUpserted,
    statementsUpserted,
    votesUpserted,
    donorsUpserted,
    contributionsUpserted,
    disclosuresUpserted
  };
}
