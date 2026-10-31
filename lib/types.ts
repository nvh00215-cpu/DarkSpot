import { z } from "zod";

// --- Source Types & Schemas ---
export const SourceInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("url"),
    url: z.string().url("Must be a valid URL").refine((val) => {
      try {
        const parsed = new URL(val);
        const hostname = parsed.hostname.toLowerCase();
        if (
          hostname === "localhost" ||
          hostname === "127.0.0.1" ||
          hostname === "::1" ||
          hostname.startsWith("192.168.") ||
          hostname.startsWith("10.") ||
          /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
        ) {
          return false;
        }
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    }, "Private, loopback, or non-http/https URLs are not allowed"),
    name: z.string().optional(),
  }),
  z.object({
    type: z.literal("text"),
    text: z.string().min(1, "Text cannot be empty").max(15000, "Text exceeds 15,000 characters limit"),
    name: z.string().optional(),
  }),
]);

export type SourceInput = z.infer<typeof SourceInputSchema>;

export const SourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["url", "text"]),
  url: z.string().optional(),
  rawText: z.string(),
  truncated: z.boolean().default(false),
  fetchError: z.string().optional(),
});

export type Source = z.infer<typeof SourceSchema>;

// --- Fact Extraction Types & Schemas ---
export const FactCategoryEnum = z.enum([
  "deadline",
  "eligibility",
  "required_documents",
  "application_process",
  "renewal_conditions",
  "fees_or_amount",
  "contact",
  "other",
]);

export type FactCategory = z.infer<typeof FactCategoryEnum>;

export const FactSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  category: FactCategoryEnum,
  value: z.string(),
  exact_quote: z.string(),
  date_mentioned: z.string().nullable(),
  isVerified: z.boolean().default(true),
  verificationNote: z.string().optional(),
});

export type Fact = z.infer<typeof FactSchema>;

export const ExtractedFactsLlmSchema = z.object({
  facts: z.array(
    z.object({
      category: FactCategoryEnum,
      value: z.string(),
      exact_quote: z.string(),
      date_mentioned: z.string().nullable().optional().default(null),
    })
  ),
});

export type ExtractedFactsLlm = z.infer<typeof ExtractedFactsLlmSchema>;

// --- Coverage Matrix & Gaps ---
export const CoverageStatusEnum = z.enum(["covered", "not_found", "unclear"]);
export type CoverageStatus = z.infer<typeof CoverageStatusEnum>;

export const TopicOverallStatusEnum = z.enum([
  "covered",
  "covered_only_by_outdated",
  "potential_gap",
]);
export type TopicOverallStatus = z.infer<typeof TopicOverallStatusEnum>;

export const CoverageMatrixItemSchema = z.object({
  topic: z.string(),
  topicDescription: z.string().optional(),
  status: TopicOverallStatusEnum, // Topic-level status
  sourceScores: z.record(z.string(), CoverageStatusEnum), // sourceId -> status
  quotes: z.record(z.string(), z.string().optional()), // sourceId -> quote
  note: z.string().optional(),
  isGap: z.boolean(), // true if not_found across all or covered only by outdated
});

export type CoverageMatrixItem = z.infer<typeof CoverageMatrixItemSchema>;

export const CoverageMatrixSchema = z.object({
  topics: z.array(CoverageMatrixItemSchema),
});

export type CoverageMatrix = z.infer<typeof CoverageMatrixSchema>;

export const GapSchema = z.object({
  id: z.string(),
  topic: z.string(),
  description: z.string(),
  gapType: z.enum(["missing_from_all_sources", "only_found_in_outdated_source"]),
  note: z.string(),
  severity: z.enum(["high", "medium", "low"]).default("medium"),
});

export type Gap = z.infer<typeof GapSchema>;

export const TopicChecklistLlmSchema = z.object({
  topics: z.array(
    z.object({
      topic: z.string(),
      description: z.string(),
    })
  ).min(4).max(10),
});

export type TopicChecklistLlm = z.infer<typeof TopicChecklistLlmSchema>;

export const TopicEvaluationLlmSchema = z.object({
  evaluations: z.array(
    z.object({
      topic: z.string(),
      status: CoverageStatusEnum,
      relevant_quote: z.string().nullable().optional(),
      explanation: z.string().optional(),
    })
  ),
});

export type TopicEvaluationLlm = z.infer<typeof TopicEvaluationLlmSchema>;

// --- Conflicts ---
export const ConflictTypeEnum = z.enum(["possible_conflict", "cycle_difference"]);
export type ConflictType = z.infer<typeof ConflictTypeEnum>;

export const ConflictConfidenceEnum = z.enum(["high", "medium", "low"]);
export type ConflictConfidence = z.infer<typeof ConflictConfidenceEnum>;

export const ConflictSchema = z.object({
  id: z.string(),
  type: ConflictTypeEnum,
  category: FactCategoryEnum,
  topic: z.string(),
  sourceA: z.object({
    sourceId: z.string(),
    sourceName: z.string(),
    quote: z.string(),
    factValue: z.string(),
    isOutdated: z.boolean().default(false),
  }),
  sourceB: z.object({
    sourceId: z.string(),
    sourceName: z.string(),
    quote: z.string(),
    factValue: z.string(),
    isOutdated: z.boolean().default(false),
  }),
  explanation: z.string(),
  confidence: ConflictConfidenceEnum,
});

export type Conflict = z.infer<typeof ConflictSchema>;

// --- Outdated & Undated Warnings (Grouped Per Source) ---
export const OutdatedEvidenceSchema = z.object({
  detectedDate: z.string().nullable(),
  evidenceType: z.enum(["older_than_12_months", "past_cycle_reference"]),
  quote: z.string().optional(),
  message: z.string(),
});

export type OutdatedEvidence = z.infer<typeof OutdatedEvidenceSchema>;

export const OutdatedWarningSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  sourceName: z.string(),
  status: z.enum(["outdated", "undated", "current"]),
  summary: z.string(),
  evidenceList: z.array(OutdatedEvidenceSchema),
});

export type OutdatedWarning = z.infer<typeof OutdatedWarningSchema>;

// --- Checklist ---
export const ChecklistPriorityEnum = z.enum(["High", "Medium", "Low"]);
export type ChecklistPriority = z.infer<typeof ChecklistPriorityEnum>;

export const ChecklistItemSchema = z.object({
  id: z.string(),
  priority: ChecklistPriorityEnum,
  title: z.string(),
  action: z.string(),
  originType: z.enum([
    "baseline_verification",
    "conflict",
    "cycle_difference",
    "missing_deadline",
    "missing_documents",
    "outdated",
    "undated",
    "gap",
  ]),
  sourceReference: z.string().optional(),
  completed: z.boolean().default(false),
});

export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

// --- LLM Call Metadata ---
export const LlmCallRecordSchema = z.object({
  task: z.string(),
  provider: z.enum(["gemini", "groq"]),
  model: z.string(),
  latencyMs: z.number(),
  usedFallback: z.boolean().default(false),
});

export type LlmCallRecord = z.infer<typeof LlmCallRecordSchema>;

// --- Overall Analysis Result ---
export const AnalysisResultSchema = z.object({
  question: z.string(),
  analyzedAt: z.string(),
  sources: z.array(SourceSchema),
  facts: z.array(FactSchema),
  coverageMatrix: CoverageMatrixSchema,
  gaps: z.array(GapSchema),
  conflicts: z.array(ConflictSchema),
  outdatedWarnings: z.array(OutdatedWarningSchema),
  checklist: z.array(ChecklistItemSchema),
  modelsUsed: z.array(LlmCallRecordSchema),
  isEmergencyFallback: z.boolean().default(false),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const AnalyzeRequestSchema = z.object({
  question: z.string().min(1, "Question is required").max(500, "Question cannot exceed 500 characters"),
  sources: z.array(SourceInputSchema).min(1, "At least 1 source is required").max(5, "Maximum 5 sources allowed"),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
