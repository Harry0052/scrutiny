import { z } from "zod";

export const confidenceSchema = z.number().min(0).max(1);

export const parserOutputSchema = z.object({
  assets: z.array(z.record(z.string(), z.any())),
  liabilities: z.array(z.record(z.string(), z.any())),
  income_sources: z.array(z.record(z.string(), z.any())),
  transactions: z.array(z.record(z.string(), z.any())),
  extraction_status: z.enum(["parsed", "partial", "failed", "pending"]),
  confidence_score: confidenceSchema,
  parser_version: z.string().optional(),
  retrieval_date: z.string().optional(),
  raw_text_excerpt: z.string().optional(),
  uncertainty_notes: z.array(z.string()).optional()
});

export const analysisOutputSchema = z.object({
  statement_id: z.string(),
  bill_id: z.string(),
  classification: z.enum(["aligned", "contradicted", "unclear"]),
  confidence_score: confidenceSchema,
  rationale: z.string(),
  evidence: z.object({
    statement_text: z.string(),
    vote_position: z.string().optional(),
    issue_tag_overlap: z.array(z.string()).optional()
  }),
  verification_state: z.enum(["VERIFIED", "UNVERIFIED", "NEEDS_VERIFICATION"]).optional(),
  uncertainty_notes: z.array(z.string()).optional()
});

export type ParserOutput = z.infer<typeof parserOutputSchema>;
export type AnalysisOutput = z.infer<typeof analysisOutputSchema>;

export function validateParserOutput(payload: unknown): ParserOutput {
  return parserOutputSchema.parse(payload);
}

export function validateAnalysisOutput(payload: unknown): AnalysisOutput {
  return analysisOutputSchema.parse(payload);
}
