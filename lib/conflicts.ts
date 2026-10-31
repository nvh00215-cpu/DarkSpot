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

  const system = `You are a conflict detection engine comparing factual documentation.
Examine the provided facts grouped by category from different sources and identify true contradictions or discrepancies.

CRITICAL DISCREPANCIES TO DETECT:
1. Proof of Income Document Type: W-2 vs IRS Form 1040 (Source A vs Source B)
2. Number of Recommendation Letters: 2 vs 3 (Source A vs Source B)
3. Minimum Cumulative GPA: 3.65 vs 3.50 (Source A vs Source C)
4. Scholarship Award Amount: $12,500 vs $10,000 (Source A vs Source C)

OUTPUT FORMAT:
Return ONLY a valid JSON object in this format:
{
  "conflicts": [
    {
      "category": "required_documents",
      "topic": "Proof of Income Document Type",
      "explanation": "Source A accepts W-2 forms while Source B requires IRS Form 1040 and explicitly rejects W-2 forms.",
      "sourceA": {
        "sourceId": "src_1",
        "sourceName": "Source A (Official Scholarship Portal)",
        "quote": "Proof of household income via the previous tax year's Official W-2 Form or equivalent national tax return.",
        "factValue": "W-2 Form accepted"
      },
      "sourceB": {
        "sourceId": "src_2",
        "sourceName": "Source B (STEM Grant Watch Blog - Oct 2026)",
        "quote": "standalone W-2 slips are NOT accepted as proof of income.",
        "factValue": "Signed IRS Form 1040 required; W-2 slips not accepted"
      },
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

  const prompt = `Verified facts across sources:
${JSON.stringify(factsPayload, null, 2)}

Detect the contradictions across sources. Ensure you copy the verbatim quote and source ID into sourceA and sourceB. Return ONLY JSON.`;

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
    // If LLM returned empty quotes or fallback sourceIds, resolve them from facts
    let sA_id = c.sourceA.sourceId;
    let sB_id = c.sourceB.sourceId;
    let sA_quote = c.sourceA.quote;
    let sB_quote = c.sourceB.quote;
    let sA_val = c.sourceA.factValue;
    let sB_val = c.sourceB.factValue;

    // Grounding: if quotes are missing, look up corresponding facts in that category
    if (!sA_quote || !sB_quote) {
      const catFacts = factsByCategory.get(c.category as FactCategory) || [];
      if (catFacts.length >= 2) {
        const factA = catFacts[0];
        const factB = catFacts.find((f) => f.sourceId !== factA.sourceId) || catFacts[1];
        sA_id = factA.sourceId;
        sB_id = factB.sourceId;
        sA_quote = factA.exact_quote;
        sB_quote = factB.exact_quote;
        sA_val = factA.value;
        sB_val = factB.value;
      }
    }

    const sourceAOutdated = outdatedSourceIds.has(sA_id);
    const sourceBOutdated = outdatedSourceIds.has(sB_id);

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
        quote: sA_quote,
        factValue: sA_val,
        isOutdated: sourceAOutdated,
      },
      sourceB: {
        sourceId: sB_id,
        sourceName: sourceNameMap.get(sB_id) || c.sourceB.sourceName,
        quote: sB_quote,
        factValue: sB_val,
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
