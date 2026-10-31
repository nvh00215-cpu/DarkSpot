import { generateJson } from "./llm";
import {
  Conflict,
  ConflictDetectionLlmSchema,
  Fact,
  FactCategory,
  LlmCallRecord,
  Source,
} from "./types";

interface ConflictsResult {
  conflicts: Conflict[];
  callRecords: LlmCallRecord[];
}

/**
 * Compares verified facts within the same category across different sources.
 * Only flags a conflict if quotes explicitly differ.
 * Does NOT invent conflicts if facts are simply complementary.
 */
export async function detectConflicts(
  facts: Fact[],
  sources: Source[]
): Promise<ConflictsResult> {
  const callRecords: LlmCallRecord[] = [];

  // Exclude unverified facts as specified in the pipeline rules
  const verifiedFacts = facts.filter((f) => f.isVerified);

  // Group facts by category
  const factsByCategory = new Map<FactCategory, Fact[]>();
  for (const fact of verifiedFacts) {
    const list = factsByCategory.get(fact.category) || [];
    list.push(fact);
    factsByCategory.set(fact.category, list);
  }

  // Filter for categories present in at least 2 distinct sources
  const sourceNameMap = new Map<string, string>(sources.map((s) => [s.id, s.name]));
  const categoriesWithMultipleSources: Array<{ category: FactCategory; facts: Fact[] }> = [];

  for (const [cat, catFacts] of factsByCategory.entries()) {
    const distinctSources = new Set(catFacts.map((f) => f.sourceId));
    if (distinctSources.size >= 2) {
      categoriesWithMultipleSources.push({ category: cat, facts: catFacts });
    }
  }

  if (categoriesWithMultipleSources.length === 0) {
    return { conflicts: [], callRecords: [] };
  }

  const system = `You are a rigorous conflict detection engine comparing factual documentation.
Your mission is to compare facts within the same category from DIFFERENT sources and detect TRUE contradictions or discrepancies.

CRITICAL RULES:
1. Only report a conflict if the quotes EXPLICITLY contradict or state mutually exclusive terms (e.g. conflicting deadlines, conflicting required documents, differing financial amounts, conflicting eligibility GPA/income thresholds).
2. DO NOT invent or assume conflicts. If two sources simply state complementary or non-contradictory details, that is NOT a conflict.
3. Every conflict MUST provide exact quotes from both sources, and a confidence level ("high", "medium", or "low").
4. Return ONLY a valid JSON object matching the requested schema with a "conflicts" array.`;

  const factsPayload = categoriesWithMultipleSources.map((item) => ({
    category: item.category,
    facts: item.facts.map((f) => ({
      sourceId: f.sourceId,
      sourceName: sourceNameMap.get(f.sourceId) || f.sourceId,
      value: f.value,
      quote: f.exact_quote,
      date_mentioned: f.date_mentioned,
    })),
  }));

  const prompt = `Review the following facts grouped by category across multiple sources:

${JSON.stringify(factsPayload, null, 2)}

Identify any real contradictions or conflicting statements between different sources.`;

  const response = await generateJson({
    system,
    prompt,
    schema: ConflictDetectionLlmSchema,
    taskName: "detect_conflicts",
  });

  callRecords.push({
    task: "detect_conflicts",
    provider: response.provider,
    model: response.model,
    latencyMs: response.latencyMs,
    usedFallback: response.usedFallback,
  });

  const conflicts: Conflict[] = response.data.conflicts.map((c, idx) => ({
    id: `conflict_${idx + 1}`,
    category: c.category as FactCategory,
    topic: c.topic,
    sourceA: {
      sourceId: c.sourceA_id,
      sourceName: sourceNameMap.get(c.sourceA_id) || c.sourceA_id,
      quote: c.sourceA_quote,
      factValue: c.sourceA_value,
    },
    sourceB: {
      sourceId: c.sourceB_id,
      sourceName: sourceNameMap.get(c.sourceB_id) || c.sourceB_id,
      quote: c.sourceB_quote,
      factValue: c.sourceB_value,
    },
    explanation: c.explanation,
    confidence: c.confidence,
  }));

  return { conflicts, callRecords };
}
