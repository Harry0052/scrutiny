-- CreateEnum
CREATE TYPE "JurisdictionLevel" AS ENUM ('NATIONAL', 'STATE', 'LOCAL');

-- CreateEnum
CREATE TYPE "StatementSourceType" AS ENUM ('PRESS_RELEASE', 'SPEECH', 'SOCIAL_MEDIA', 'INTERVIEW', 'COMMITTEE_HEARING', 'CAMPAIGN_SITE', 'OTHER');

-- CreateEnum
CREATE TYPE "VotePosition" AS ENUM ('YES', 'NO', 'ABSTAIN', 'PRESENT', 'NOT_VOTING');

-- CreateEnum
CREATE TYPE "DonorType" AS ENUM ('INDIVIDUAL', 'PAC', 'INDUSTRY', 'ASSOCIATION', 'NONPROFIT', 'OTHER');

-- CreateEnum
CREATE TYPE "DisclosureExtractionStatus" AS ENUM ('PENDING', 'PARSED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "AlignmentClassification" AS ENUM ('ALIGNED', 'CONTRADICTED', 'UNCLEAR');

-- CreateEnum
CREATE TYPE "ImpactAlignment" AS ENUM ('ALIGNED', 'PARTIAL', 'MISALIGNED', 'INSUFFICIENT_DATA');

-- CreateTable
CREATE TABLE "Politician" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "slug" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "party" TEXT,
    "officeTitle" TEXT NOT NULL,
    "chamber" TEXT,
    "jurisdictionLevel" "JurisdictionLevel" NOT NULL,
    "jurisdictionCountry" TEXT NOT NULL DEFAULT 'US',
    "jurisdictionState" TEXT,
    "districtLabel" TEXT,
    "districtId" TEXT,
    "termStart" TIMESTAMP(3),
    "termEnd" TIMESTAMP(3),
    "externalProfiles" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Politician_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Statement" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "politicianId" TEXT NOT NULL,
    "sourceType" "StatementSourceType" NOT NULL,
    "sourceUrl" TEXT,
    "sourceLabel" TEXT,
    "text" TEXT NOT NULL,
    "issueTags" TEXT[],
    "madeAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Statement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "billCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "issueTags" TEXT[],
    "jurisdictionLevel" "JurisdictionLevel" NOT NULL,
    "jurisdictionCountry" TEXT NOT NULL DEFAULT 'US',
    "jurisdictionState" TEXT,
    "chamber" TEXT,
    "introducedAt" TIMESTAMP(3),
    "latestActionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "politicianId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "votePosition" "VotePosition" NOT NULL,
    "voteWeight" DOUBLE PRECISION DEFAULT 1,
    "rollCallReference" TEXT,
    "votedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatementBillLink" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "relevanceRationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatementBillLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donor" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "donorType" "DonorType" NOT NULL,
    "sector" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Donor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonorContribution" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "donorId" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "amountUsd" DECIMAL(14,2) NOT NULL,
    "contributionDate" TIMESTAMP(3) NOT NULL,
    "electionCycle" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "contributionType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonorContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialDisclosure" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "politicianId" TEXT NOT NULL,
    "filingYear" INTEGER NOT NULL,
    "reportType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "rawPdfPath" TEXT,
    "parsedData" JSONB,
    "extractionStatus" "DisclosureExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "extractionConfidence" DOUBLE PRECISION,
    "parserVersion" TEXT,
    "filedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialDisclosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisclosureAsset" (
    "id" TEXT NOT NULL,
    "financialDisclosureId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "owner" TEXT,
    "valueMinUsd" INTEGER,
    "valueMaxUsd" INTEGER,

    CONSTRAINT "DisclosureAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisclosureLiability" (
    "id" TEXT NOT NULL,
    "financialDisclosureId" TEXT NOT NULL,
    "creditor" TEXT NOT NULL,
    "liabilityType" TEXT,
    "amountMinUsd" INTEGER,
    "amountMaxUsd" INTEGER,

    CONSTRAINT "DisclosureLiability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisclosureIncomeSource" (
    "id" TEXT NOT NULL,
    "financialDisclosureId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "incomeType" TEXT,
    "incomeMinUsd" INTEGER,
    "incomeMaxUsd" INTEGER,

    CONSTRAINT "DisclosureIncomeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisclosureTransaction" (
    "id" TEXT NOT NULL,
    "financialDisclosureId" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3),
    "amountMinUsd" INTEGER,
    "amountMaxUsd" INTEGER,

    CONSTRAINT "DisclosureTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jurisdictionLevel" "JurisdictionLevel" NOT NULL,
    "jurisdictionCountry" TEXT NOT NULL DEFAULT 'US',
    "jurisdictionState" TEXT,
    "population" INTEGER,
    "medianHouseholdIncomeUsd" INTEGER,
    "demographics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistrictIssueIndicator" (
    "id" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "issueTag" TEXT NOT NULL,
    "indicatorName" TEXT NOT NULL,
    "indicatorValue" DOUBLE PRECISION NOT NULL,
    "indicatorUnit" TEXT,
    "normalizedNeedScore" DOUBLE PRECISION NOT NULL,
    "sourceLabel" TEXT,
    "sourceYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistrictIssueIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisResult" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "politicianId" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "billId" TEXT,
    "voteId" TEXT,
    "classification" "AlignmentClassification" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "comparable" BOOLEAN NOT NULL DEFAULT true,
    "methodVersion" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HonestyScoreSnapshot" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "consistentActions" INTEGER NOT NULL,
    "totalComparableStatements" INTEGER NOT NULL,
    "honestyScore" DOUBLE PRECISION NOT NULL,
    "methodologyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HonestyScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstituentImpactResult" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "politicianId" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "voteId" TEXT,
    "issueTag" TEXT NOT NULL,
    "impactAlignment" "ImpactAlignment" NOT NULL,
    "impactScore" DOUBLE PRECISION NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "methodVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConstituentImpactResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Politician_externalId_key" ON "Politician"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Politician_slug_key" ON "Politician"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Statement_externalId_key" ON "Statement"("externalId");

-- CreateIndex
CREATE INDEX "Statement_politicianId_madeAt_idx" ON "Statement"("politicianId", "madeAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_externalId_key" ON "Bill"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_billCode_key" ON "Bill"("billCode");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_externalId_key" ON "Vote"("externalId");

-- CreateIndex
CREATE INDEX "Vote_billId_votedAt_idx" ON "Vote"("billId", "votedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_politicianId_billId_votedAt_key" ON "Vote"("politicianId", "billId", "votedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StatementBillLink_statementId_billId_key" ON "StatementBillLink"("statementId", "billId");

-- CreateIndex
CREATE UNIQUE INDEX "Donor_externalId_key" ON "Donor"("externalId");

-- CreateIndex
CREATE INDEX "Donor_sector_idx" ON "Donor"("sector");

-- CreateIndex
CREATE UNIQUE INDEX "DonorContribution_externalId_key" ON "DonorContribution"("externalId");

-- CreateIndex
CREATE INDEX "DonorContribution_politicianId_electionCycle_idx" ON "DonorContribution"("politicianId", "electionCycle");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialDisclosure_externalId_key" ON "FinancialDisclosure"("externalId");

-- CreateIndex
CREATE INDEX "FinancialDisclosure_politicianId_filingYear_idx" ON "FinancialDisclosure"("politicianId", "filingYear");

-- CreateIndex
CREATE UNIQUE INDEX "District_code_key" ON "District"("code");

-- CreateIndex
CREATE INDEX "DistrictIssueIndicator_districtId_issueTag_idx" ON "DistrictIssueIndicator"("districtId", "issueTag");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisResult_externalId_key" ON "AnalysisResult"("externalId");

-- CreateIndex
CREATE INDEX "AnalysisResult_politicianId_createdAt_idx" ON "AnalysisResult"("politicianId", "createdAt");

-- CreateIndex
CREATE INDEX "HonestyScoreSnapshot_politicianId_createdAt_idx" ON "HonestyScoreSnapshot"("politicianId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConstituentImpactResult_externalId_key" ON "ConstituentImpactResult"("externalId");

-- CreateIndex
CREATE INDEX "ConstituentImpactResult_politicianId_createdAt_idx" ON "ConstituentImpactResult"("politicianId", "createdAt");

-- AddForeignKey
ALTER TABLE "Politician" ADD CONSTRAINT "Politician_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementBillLink" ADD CONSTRAINT "StatementBillLink_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Statement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementBillLink" ADD CONSTRAINT "StatementBillLink_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorContribution" ADD CONSTRAINT "DonorContribution_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorContribution" ADD CONSTRAINT "DonorContribution_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialDisclosure" ADD CONSTRAINT "FinancialDisclosure_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureAsset" ADD CONSTRAINT "DisclosureAsset_financialDisclosureId_fkey" FOREIGN KEY ("financialDisclosureId") REFERENCES "FinancialDisclosure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureLiability" ADD CONSTRAINT "DisclosureLiability_financialDisclosureId_fkey" FOREIGN KEY ("financialDisclosureId") REFERENCES "FinancialDisclosure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureIncomeSource" ADD CONSTRAINT "DisclosureIncomeSource_financialDisclosureId_fkey" FOREIGN KEY ("financialDisclosureId") REFERENCES "FinancialDisclosure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureTransaction" ADD CONSTRAINT "DisclosureTransaction_financialDisclosureId_fkey" FOREIGN KEY ("financialDisclosureId") REFERENCES "FinancialDisclosure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistrictIssueIndicator" ADD CONSTRAINT "DistrictIssueIndicator_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisResult" ADD CONSTRAINT "AnalysisResult_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisResult" ADD CONSTRAINT "AnalysisResult_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Statement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisResult" ADD CONSTRAINT "AnalysisResult_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisResult" ADD CONSTRAINT "AnalysisResult_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "Vote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HonestyScoreSnapshot" ADD CONSTRAINT "HonestyScoreSnapshot_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstituentImpactResult" ADD CONSTRAINT "ConstituentImpactResult_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstituentImpactResult" ADD CONSTRAINT "ConstituentImpactResult_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstituentImpactResult" ADD CONSTRAINT "ConstituentImpactResult_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstituentImpactResult" ADD CONSTRAINT "ConstituentImpactResult_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "Vote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

