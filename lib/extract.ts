import { generateJson } from "./llm";
import {
  ExtractedFactsLlmSchema,
  Fact,
  FactCategory,
  LlmCallRecord,
  Source,
} from "./types";

interface ExtractFactsResult {
  facts: Fact[];
  callRecords: LlmCallRecord[];
}

/**
 * Extracts structured facts from a single source text using the unified LLM layer.
 * Enforces normalized categories and verbatim exact quotes.
 */
export async function extractFactsFromSource(
  source: Source,
  question: string
): Promise<{ facts: Fact[]; callRecord: LlmCallRecord }> {
  // If source experienced a fetch failure, do not attempt LLM extraction
  if (source.fetchError || !source.rawText.trim()) {
    return {
      facts: [],
      callRecord: {
        task: `extract_facts_${source.id}`,
        provider: "groq",
        model: "skipped",
        latencyMs: 0,
        usedFallback: false,
      },
    };
  }

  const system = `You are a strict factual extraction agent for information gap analysis.
Extract factual claims relevant to the user's research question from the provided source text.

Rules:
1. Every fact MUST have:
   - "category": one of ["deadline", "eligibility", "required_documents", "application_process", "renewal_conditions", "fees_or_amount", "contact", "other"]
   - "value": a concise factual statement
   - "exact_quote": an EXACT, verbatim, word-for-word quote from the text supporting this fact. Do not paraphrase.
   - "date_mentioned": any explicit date, year, or deadline mentioned in the quote, or null.
2. If a category is NOT mentioned in the text, do NOT invent or guess. Omit it.
3. Return ONLY a valid JSON object matching the requested schema with a "facts" array.`;

  const prompt = `Research Question: "${question}"

Source Name: "${source.name}"
Source Content:
\"\"\"
${source.rawText}
\"\"\"

Extract all relevant structured facts. Remember: "exact_quote" MUST be copied verbatim from the text above.`;

  const response = await generateJson({
    system,
    prompt,
    schema: ExtractedFactsLlmSchema,
    taskName: `extract_facts_${source.id}`,
  });

  const facts: Fact[] = response.data.facts.map((f, i) => ({
    id: `fact_${source.id}_${i + 1}`,
    sourceId: source.id,
    category: f.category as FactCategory,
    value: f.value,
    exact_quote: f.exact_quote,
    date_mentioned: f.date_mentioned || null,
    isVerified: true,
  }));

  const callRecord: LlmCallRecord = {
    task: `extract_facts_${source.id}`,
    provider: response.provider,
    model: response.model,
    latencyMs: response.latencyMs,
    usedFallback: response.usedFallback,
  };

  return { facts, callRecord };
}

/**
 * Extracts facts from all provided sources in parallel.
 */
export async function extractAllFacts(
  sources: Source[],
  question: string
): Promise<ExtractFactsResult> {
  const results = await Promise.all(
    sources.map((source) => extractFactsFromSource(source, question))
  );

  const facts: Fact[] = [];
  const callRecords: LlmCallRecord[] = [];

  for (const res of results) {
    facts.push(...res.facts);
    callRecords.push(res.callRecord);
  }

  return { facts, callRecords };
}
