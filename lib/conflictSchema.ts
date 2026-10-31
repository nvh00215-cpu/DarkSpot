import { z } from "zod";
import { FactCategoryEnum, ConflictConfidenceEnum } from "./types";

export const RobustConflictDetectionLlmSchema = z.object({
  conflicts: z.array(
    z.object({
      category: z.preprocess((val) => {
        if (typeof val === "string") return val.toLowerCase().replace(/[\s-]/g, "_");
        return val;
      }, FactCategoryEnum).default("other"),
      topic: z.string().min(1, "Topic is required"),
      explanation: z.string().min(1, "Explanation is required"),
      confidence: z.preprocess((val) => {
        if (typeof val === "string") return val.toLowerCase();
        return val;
      }, ConflictConfidenceEnum).default("medium"),

      // We accept sourceA / sourceB as objects or flat fields
      sourceA_id: z.string().optional(),
      sourceA_name: z.string().optional(),
      sourceA_quote: z.string().optional(),
      sourceA_value: z.string().optional(),

      sourceB_id: z.string().optional(),
      sourceB_name: z.string().optional(),
      sourceB_quote: z.string().optional(),
      sourceB_value: z.string().optional(),

      sourceA: z
        .object({
          id: z.string().optional(),
          sourceId: z.string().optional(),
          name: z.string().optional(),
          sourceName: z.string().optional(),
          quote: z.string().optional(),
          factValue: z.string().optional(),
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
          factValue: z.string().optional(),
          value: z.string().optional(),
        })
        .optional(),
    }).transform((item) => {
      const sA_id = item.sourceA?.sourceId || item.sourceA?.id || item.sourceA_id || "src_1";
      const sA_name = item.sourceA?.sourceName || item.sourceA?.name || item.sourceA_name || sA_id;
      const sA_quote = item.sourceA?.quote || item.sourceA_quote || "";
      const sA_value = item.sourceA?.factValue || item.sourceA?.value || item.sourceA_value || "";

      const sB_id = item.sourceB?.sourceId || item.sourceB?.id || item.sourceB_id || "src_2";
      const sB_name = item.sourceB?.sourceName || item.sourceB?.name || item.sourceB_name || sB_id;
      const sB_quote = item.sourceB?.quote || item.sourceB_quote || "";
      const sB_value = item.sourceB?.factValue || item.sourceB?.value || item.sourceB_value || "";

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
    })
  ),
});
