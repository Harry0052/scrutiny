import { prisma } from "@/lib/prisma";
import { isDatabaseConfigured } from "@/lib/services/dashboard";

export async function getPoliticianProfileDetail(slug: string) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  return prisma.politician.findUnique({
    where: { slug },
    include: {
      aliases: { orderBy: { alias: "asc" } },
      officeHistory: { orderBy: { startDate: "desc" }, take: 10 },
      district: true,
      statements: { orderBy: { madeAt: "desc" }, take: 8 },
      votes: { orderBy: { votedAt: "desc" }, include: { bill: true }, take: 8 },
      donorContributions: { include: { donor: true }, orderBy: { contributionDate: "desc" }, take: 8 },
      financialDisclosures: { orderBy: { filingYear: "desc" }, take: 8 },
      constituentImpactResults: { include: { bill: true }, orderBy: { createdAt: "desc" }, take: 8 }
    }
  });
}

export async function getStatementDetail(id: string) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  return prisma.statement.findUnique({
    where: { id },
    include: {
      politician: true,
      candidateLinks: {
        include: {
          bill: true
        }
      },
      analysisResults: {
        include: {
          bill: true,
          vote: true
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });
}

export async function getVoteDetail(id: string) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  return prisma.vote.findUnique({
    where: { id },
    include: {
      politician: true,
      bill: true,
      analysisResults: {
        include: {
          statement: true
        }
      },
      constituentImpactResults: true
    }
  });
}

export async function getDonorContributionDetail(id: string) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  return prisma.donorContribution.findUnique({
    where: { id },
    include: {
      donor: true,
      politician: true
    }
  });
}

export async function getDisclosureDetail(id: string) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  return prisma.financialDisclosure.findUnique({
    where: { id },
    include: {
      politician: true,
      assets: true,
      liabilities: true,
      incomeSources: true,
      transactions: true
    }
  });
}

export async function getAnalysisDetail(id: string) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  return prisma.analysisResult.findUnique({
    where: { id },
    include: {
      politician: true,
      statement: true,
      bill: true,
      vote: true
    }
  });
}
