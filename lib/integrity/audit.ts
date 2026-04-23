import { Prisma } from "@prisma/client";
import type { DataLayer, ProcessingStatus, VerificationState } from "@prisma/client";

import { prisma } from "@/lib/prisma";

interface LineageEntryInput {
  recordType: string;
  recordId: string;
  layer: DataLayer;
  sourceUrl?: string;
  sourceType?: string;
  retrievalDate?: Date;
  parserVersion?: string;
  extractionStatus?: string;
  confidenceScore?: number;
  verificationState?: VerificationState;
  rawTextSnapshot?: string;
  rawJsonSnapshot?: Prisma.InputJsonValue;
  notes?: string;
}

interface ParserRunLogInput {
  sourceType: string;
  sourceUrl?: string;
  parserVersion: string;
  status: ProcessingStatus;
  confidenceScore?: number;
  recordType?: string;
  recordId?: string;
  message: string;
  rawInputSnapshot?: Prisma.InputJsonValue;
  rawOutputSnapshot?: Prisma.InputJsonValue;
}

interface AnalysisRunLogInput {
  methodVersion: string;
  status: ProcessingStatus;
  classification?: "ALIGNED" | "CONTRADICTED" | "UNCLEAR";
  confidenceScore?: number;
  recordType?: string;
  recordId?: string;
  statementId?: string;
  billId?: string;
  voteId?: string;
  message: string;
  rawInputSnapshot?: Prisma.InputJsonValue;
  rawOutputSnapshot?: Prisma.InputJsonValue;
  verificationState?: VerificationState;
}

export async function appendLineageEntry(input: LineageEntryInput) {
  return prisma.dataLineage.create({
    data: {
      ...input,
      verificationState: input.verificationState ?? "UNVERIFIED"
    }
  });
}

export async function logParserRun(input: ParserRunLogInput) {
  return prisma.parserRunLog.create({ data: input });
}

export async function logAnalysisRun(input: AnalysisRunLogInput) {
  return prisma.analysisRunLog.create({
    data: {
      ...input,
      verificationState: input.verificationState ?? "UNVERIFIED"
    }
  });
}

export async function getRecordAuditTrace(recordType: string, recordId: string) {
  const [lineage, parserLogs, analysisLogs] = await Promise.all([
    prisma.dataLineage.findMany({ where: { recordType, recordId }, orderBy: { createdAt: "desc" } }),
    prisma.parserRunLog.findMany({ where: { recordType, recordId }, orderBy: { createdAt: "desc" } }),
    prisma.analysisRunLog.findMany({ where: { recordType, recordId }, orderBy: { createdAt: "desc" } })
  ]);

  return {
    recordType,
    recordId,
    lineage,
    parserLogs,
    analysisLogs
  };
}
