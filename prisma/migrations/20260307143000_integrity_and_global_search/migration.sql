-- CreateEnum
CREATE TYPE "DataLayer" AS ENUM ('RAW', 'NORMALIZED', 'INTERPRETED');

-- CreateEnum
CREATE TYPE "VerificationState" AS ENUM ('VERIFIED', 'UNVERIFIED', 'NEEDS_VERIFICATION');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "PublicFigureStatus" AS ENUM ('OFFICEHOLDER', 'CANDIDATE', 'FORMER_OFFICEHOLDER');

-- CreateEnum
CREATE TYPE "IncumbentChallengerStatus" AS ENUM ('INCUMBENT', 'CHALLENGER', 'OPEN_SEAT', 'UNKNOWN');

-- AlterTable
ALTER TABLE "AnalysisResult" ADD COLUMN     "rawEvidenceSnapshot" JSONB,
ADD COLUMN     "sourceRetrievedAt" TIMESTAMP(3),
ADD COLUMN     "verificationState" "VerificationState" NOT NULL DEFAULT 'UNVERIFIED';

-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "extractionConfidence" DOUBLE PRECISION,
ADD COLUMN     "parserVersion" TEXT,
ADD COLUMN     "rawSourceSnapshot" JSONB,
ADD COLUMN     "sourceRetrievedAt" TIMESTAMP(3),
ADD COLUMN     "verificationState" "VerificationState" NOT NULL DEFAULT 'UNVERIFIED';

-- AlterTable
ALTER TABLE "ConstituentImpactResult" ADD COLUMN     "verificationState" "VerificationState" NOT NULL DEFAULT 'UNVERIFIED';

-- AlterTable
ALTER TABLE "DonorContribution" ADD COLUMN     "extractionConfidence" DOUBLE PRECISION,
ADD COLUMN     "parserVersion" TEXT,
ADD COLUMN     "rawSourceSnapshot" JSONB,
ADD COLUMN     "sourceRetrievedAt" TIMESTAMP(3),
ADD COLUMN     "verificationState" "VerificationState" NOT NULL DEFAULT 'UNVERIFIED';

-- AlterTable
ALTER TABLE "FinancialDisclosure" ADD COLUMN     "rawTextSnapshot" TEXT,
ADD COLUMN     "sourceRetrievedAt" TIMESTAMP(3),
ADD COLUMN     "verificationState" "VerificationState" NOT NULL DEFAULT 'UNVERIFIED';

-- AlterTable
ALTER TABLE "Politician" ADD COLUMN     "candidateStatus" "PublicFigureStatus" NOT NULL DEFAULT 'OFFICEHOLDER',
ADD COLUMN     "city" TEXT,
ADD COLUMN     "county" TEXT,
ADD COLUMN     "electionYear" INTEGER,
ADD COLUMN     "incumbentChallengerStatus" "IncumbentChallengerStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "issueFocusTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "latestActivityAt" TIMESTAMP(3),
ADD COLUMN     "latestActivitySummary" TEXT,
ADD COLUMN     "normalizedFullName" TEXT,
ADD COLUMN     "officeSought" TEXT;

-- AlterTable
ALTER TABLE "Statement" ADD COLUMN     "extractionConfidence" DOUBLE PRECISION,
ADD COLUMN     "parserVersion" TEXT,
ADD COLUMN     "rawSourceSnapshot" JSONB,
ADD COLUMN     "sourceRetrievedAt" TIMESTAMP(3),
ADD COLUMN     "verificationState" "VerificationState" NOT NULL DEFAULT 'UNVERIFIED';

-- AlterTable
ALTER TABLE "Vote" ADD COLUMN     "extractionConfidence" DOUBLE PRECISION,
ADD COLUMN     "parserVersion" TEXT,
ADD COLUMN     "rawSourceSnapshot" JSONB,
ADD COLUMN     "sourceRetrievedAt" TIMESTAMP(3),
ADD COLUMN     "verificationState" "VerificationState" NOT NULL DEFAULT 'UNVERIFIED';

-- CreateTable
CREATE TABLE "PoliticianAlias" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoliticianAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeHistory" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "officeTitle" TEXT NOT NULL,
    "chamber" TEXT,
    "jurisdictionLevel" "JurisdictionLevel" NOT NULL,
    "jurisdictionState" TEXT,
    "city" TEXT,
    "county" TEXT,
    "districtLabel" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "electionYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicFigureSearchDocument" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "normalizedFullName" TEXT NOT NULL,
    "aliases" TEXT[],
    "officeDisplay" TEXT NOT NULL,
    "officeHeld" TEXT,
    "officeSought" TEXT,
    "chamber" TEXT,
    "party" TEXT,
    "jurisdictionLevel" "JurisdictionLevel" NOT NULL,
    "jurisdictionState" TEXT,
    "city" TEXT,
    "county" TEXT,
    "districtLabel" TEXT,
    "candidateStatus" "PublicFigureStatus" NOT NULL,
    "incumbentChallengerStatus" "IncumbentChallengerStatus" NOT NULL DEFAULT 'UNKNOWN',
    "electionYear" INTEGER,
    "issueTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "honestyScore" DOUBLE PRECISION,
    "donorVolumeUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recentVotesCount" INTEGER NOT NULL DEFAULT 0,
    "latestDisclosureYear" INTEGER,
    "latestActivityAt" TIMESTAMP(3),
    "latestActivitySummary" TEXT,
    "searchBlob" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicFigureSearchDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataLineage" (
    "id" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "layer" "DataLayer" NOT NULL,
    "sourceUrl" TEXT,
    "sourceType" TEXT,
    "retrievalDate" TIMESTAMP(3),
    "parserVersion" TEXT,
    "extractionStatus" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "verificationState" "VerificationState" NOT NULL DEFAULT 'UNVERIFIED',
    "rawTextSnapshot" TEXT,
    "rawJsonSnapshot" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataLineage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParserRunLog" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "parserVersion" TEXT NOT NULL,
    "status" "ProcessingStatus" NOT NULL,
    "confidenceScore" DOUBLE PRECISION,
    "recordType" TEXT,
    "recordId" TEXT,
    "message" TEXT NOT NULL,
    "rawInputSnapshot" JSONB,
    "rawOutputSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParserRunLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisRunLog" (
    "id" TEXT NOT NULL,
    "methodVersion" TEXT NOT NULL,
    "status" "ProcessingStatus" NOT NULL,
    "classification" "AlignmentClassification",
    "confidenceScore" DOUBLE PRECISION,
    "recordType" TEXT,
    "recordId" TEXT,
    "statementId" TEXT,
    "billId" TEXT,
    "voteId" TEXT,
    "message" TEXT NOT NULL,
    "rawInputSnapshot" JSONB,
    "rawOutputSnapshot" JSONB,
    "verificationState" "VerificationState" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisRunLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PoliticianAlias_normalizedAlias_idx" ON "PoliticianAlias"("normalizedAlias");

-- CreateIndex
CREATE INDEX "PoliticianAlias_politicianId_idx" ON "PoliticianAlias"("politicianId");

-- CreateIndex
CREATE INDEX "OfficeHistory_politicianId_isCurrent_idx" ON "OfficeHistory"("politicianId", "isCurrent");

-- CreateIndex
CREATE INDEX "OfficeHistory_jurisdictionLevel_jurisdictionState_county_ci_idx" ON "OfficeHistory"("jurisdictionLevel", "jurisdictionState", "county", "city");

-- CreateIndex
CREATE UNIQUE INDEX "PublicFigureSearchDocument_politicianId_key" ON "PublicFigureSearchDocument"("politicianId");

-- CreateIndex
CREATE INDEX "PublicFigureSearchDocument_normalizedFullName_idx" ON "PublicFigureSearchDocument"("normalizedFullName");

-- CreateIndex
CREATE INDEX "PublicFigureSearchDocument_candidateStatus_electionYear_idx" ON "PublicFigureSearchDocument"("candidateStatus", "electionYear");

-- CreateIndex
CREATE INDEX "PublicFigureSearchDocument_jurisdictionLevel_jurisdictionSt_idx" ON "PublicFigureSearchDocument"("jurisdictionLevel", "jurisdictionState", "county", "city");

-- CreateIndex
CREATE INDEX "PublicFigureSearchDocument_party_chamber_idx" ON "PublicFigureSearchDocument"("party", "chamber");

-- CreateIndex
CREATE INDEX "DataLineage_recordType_recordId_idx" ON "DataLineage"("recordType", "recordId");

-- CreateIndex
CREATE INDEX "DataLineage_layer_createdAt_idx" ON "DataLineage"("layer", "createdAt");

-- CreateIndex
CREATE INDEX "Politician_normalizedFullName_idx" ON "Politician"("normalizedFullName");

-- CreateIndex
CREATE INDEX "Politician_candidateStatus_electionYear_idx" ON "Politician"("candidateStatus", "electionYear");

-- CreateIndex
CREATE INDEX "Politician_jurisdictionLevel_jurisdictionState_county_city_idx" ON "Politician"("jurisdictionLevel", "jurisdictionState", "county", "city");

-- AddForeignKey
ALTER TABLE "PoliticianAlias" ADD CONSTRAINT "PoliticianAlias_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeHistory" ADD CONSTRAINT "OfficeHistory_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicFigureSearchDocument" ADD CONSTRAINT "PublicFigureSearchDocument_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Search acceleration for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "PublicFigureSearchDocument_normalizedFullName_trgm_idx"
  ON "PublicFigureSearchDocument"
  USING GIN ("normalizedFullName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "PublicFigureSearchDocument_searchBlob_trgm_idx"
  ON "PublicFigureSearchDocument"
  USING GIN ("searchBlob" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Politician_normalizedFullName_trgm_idx"
  ON "Politician"
  USING GIN ("normalizedFullName" gin_trgm_ops);
