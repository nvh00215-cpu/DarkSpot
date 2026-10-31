import { z } from "zod";
import {
  Conflict,
  ConflictConfidenceEnum,
  FactCategory,
  FactCategoryEnum,
} from "./types";

// Permissive item schema that handles flat keys (sourceA_id) or nested objects (sourceA: { id, quote, value })
export const ConflictDetectionItemSchema = z
  .object({
    category: z.preprocess((val) => {
      if (typeof val === "string") {
        const lower = val.toLowerCase().replace(/[\s-]/g, "_");
        return lower;
      }
      return val;
    }, FactCategoryEnum).default("other"),
    topic: z.string().optional().default("Discrepancy"),

    // Flat format
    sourceA_id: z.string().optional(),
    sourceA_name: z.string().optional(),
    sourceA_quote: z.string().optional(),
    sourceA_value: z.string().optional(),

    sourceB_id: z.string().optional(),
    sourceB_name: z.string().optional(),
    sourceB_quote: z.string().optional(),
    sourceB_value: z.string().optional(),

    // Nested format (sometimes produced by LLMs)
    sourceA: z
      .object({
        id: z.string().optional(),
        sourceId: z.string().optional(),
        name: z.string().optional(),
        sourceName: z.string().optional(),
        quote: z.string().optional(),
        value: z.string().optional(),
      })
      .optional(),
    sourceB: z
      .object({
        id: z.string().optional(),
        sourceId: z.string().optional(),
        name: z.string().optional(),
        sourceName: z.string().optional(),
        quote: z.string().optional(),
        value: z.string().optional(),
      })
      .optional(),

    explanation: z.string().optional().default("Incompatible statements between sources."),
    confidence: z.preprocess((val) => {
      if (typeof val === "string") return val.toLowerCase();
      return val;
    }, ConflictConfidenceEnum).default("medium"),
  })
  .transform((item) => {
    const sA_id = item.sourceA_id || item.sourceA?.sourceId || item.sourceA?.id || "src_1";
    const sA_name = item.sourceA_name || item.sourceA?.sourceName || item.sourceA?.name || sA_id;
    const sA_quote = item.sourceA_quote || item.sourceA?.quote || "";
    const sA_value = item.sourceA_value || item.sourceA?.value || "";

    const sB_id = item.sourceB_id || item.sourceB?.sourceId || item.sourceB?.id || "src_2";
    const sB_name = item.sourceB_name || item.sourceB?.sourceName || item.sourceB?.name || sB_id;
    const sB_quote = item.sourceB_quote || item.sourceB?.quote || "";
    const sB_value = item.sourceB_value || item.sourceB?.value || "";

    return {
      category: item.category,
      topic: item.topic,
      sourceA: {
        sourceId: sA_id,
        sourceName: sA_name,
        quote: sA_quote,
        factValue: sA_value,
      },
      sourceB: {
        sourceId: sB_id,
        sourceName: sB_name,
        quote: sB_quote,
        factValue: sB_value,
      },
      explanation: item.explanation,
      confidence: item.confidence,
    };
  });

export const RobustConflictDetectionLlmSchema = z.object({
  conflicts: z.array(ConflictDetectionItemSchema),
});
