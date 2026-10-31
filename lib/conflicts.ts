import { generateJson } from "./llm";
import { RobustConflictDetectionLlmSchema } from "./conflictSchema";
import {
  Conflict,
  Fact,
  FactCategory,
  LlmCallRecord,
  OutdatedWarning,
  Source,
} from "./types";

interface ConflictsParams {
  facts: Fact[];
  sources: Source[];
  outdatedWarnings: OutdatedWarning[];
}

interface ConflictsResult {
  conflicts: Conflict[];
  callRecords: LlmCallRecord[];
}

export async function detectConflicts({
  facts,
  sources,
  outdatedWarnings,
}: ConflictsParams): Promise<ConflictsResult> {
  const callRecords: LlmCallRecord[] = [];

  const verifiedFacts = facts.filter((f) => f.isVerified);
  const outdatedSourceIds = new Set(
    outdatedWarnings.filter((w) => w.status === "outdated").map((w) => w.sourceId)
  );

  const factsByCategory = new Map<FactCategory, Fact[]>();
  for (const fact of verifiedFacts) {
    const list = factsByCategory.get(fact.category) || [];
    list.push(fact);
    factsByCategory.set(fact.category, list);
  }

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

  const system = `You are a factual conflict detection engine comparing scholarship requirements.
Compare facts within the same category from DIFFERENT sources and detect true contradictions.

CRITICAL RULES:
1. ONLY report a conflict if the statements directly disagree or state mutually exclusive terms (e.g. conflicting income tax documents: W-2 vs IRS 1040, conflicting number of letters: 2 vs 3, conflicting GPA: 3.65 vs 3.50, conflicting amounts: $12,500 vs $10,000).
2. DO NOT invent conflicts if facts are simply complementary.
3. You MUST provide the exact "sourceA_id", "sourceA_quote", "sourceA_value", "sourceB_id", "sourceB_quote", and "sourceB_value" directly from the facts listed below.
4. Return ONLY valid JSON in this exact structure:
{
  "conflicts": [
    {
      "category": "required_documents",
      "topic": "Tax Document Proof of Income",
      "sourceA_id": "src_1",
      "sourceA_name": "Source A (Official Scholarship Portal)",
      "sourceA_quote": "Proof of household income via the previous tax year's Official W-2 Form or equivalent national tax return.",
      "sourceA_value": "W-2 form accepted",
      "sourceB_id": "src_2",
      "sourceB_name": "Source B (STEM Grant Watch Blog - Oct 2026)",
      "sourceB_quote": "standalone W-2 slips are NOT accepted as proof of income.",
      "sourceB_value": "W-2 slips NOT accepted; IRS Form 1040 required",
      "explanation": "Source A accepts W-2 slips whereas Source B explicitly prohibits them and requires Form 1040.",
      "confidence": "high"
    }
  ]
}`;

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

  const prompt = `Review these facts across sources:
${JSON.stringify(factsPayload, null, 2)}

Detect real contradictions and return the exact quotes and source IDs. Return ONLY JSON.`;

  const response = await generateJson({
    system,
    prompt,
    schema: RobustConflictDetectionLlmSchema,
    taskName: "detect_conflicts",
  });

  callRecords.push({
    task: "detect_conflicts",
    provider: response.provider,
    model: response.model,
    latencyMs: response.latencyMs,
    usedFallback: response.usedFallback,
  });

  const conflicts: Conflict[] = response.data.conflicts.map((c, idx) => {
    const sA_id = c.sourceA.sourceId;
    const sB_id = c.sourceB.sourceId;

    const sourceAOutdated = outdatedSourceIds.has(sA_id);
    const sourceBOutdated = outdatedSourceIds.has(sB_id);

    // Rule: if one side comes from an outdated source, set type "cycle_difference" with medium confidence
    const hasOutdatedSide = sourceAOutdated || sourceBOutdated;
    const type = hasOutdatedSide ? "cycle_difference" : "possible_conflict";
    const confidence = hasOutdatedSide ? "medium" : c.confidence;

    return {
      id: `conflict_${idx + 1}`,
      type,
      category: c.category as FactCategory,
      topic: c.topic,
      sourceA: {
        sourceId: sA_id,
        sourceName: sourceNameMap.get(sA_id) || c.sourceA.sourceName,
        quote: c.sourceA.quote,
        factValue: c.sourceA.factValue,
        isOutdated: sourceAOutdated,
      },
      sourceB: {
        sourceId: sB_id,
        sourceName: sourceNameMap.get(sB_id) || c.sourceB.sourceName,
        quote: c.sourceB.quote,
        factValue: c.sourceB.factValue,
        isOutdated: sourceBOutdated,
      },
      explanation: hasOutdatedSide
        ? `${c.explanation} (Note: Likely a cycle-to-cycle revision between older and current guidelines).`
        : c.explanation,
      confidence,
    };
  });

  return { conflicts, callRecords };
}
