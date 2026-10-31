import { generateJson } from "./llm";
import {
  CoverageMatrix,
  CoverageMatrixItem,
  Gap,
  LlmCallRecord,
  Source,
  TopicChecklistLlmSchema,
  TopicEvaluationLlmSchema,
} from "./types";

interface CoverageResult {
  coverageMatrix: CoverageMatrix;
  gaps: Gap[];
  callRecords: LlmCallRecord[];
}

/**
 * 1. Generates 6-10 essential checklist topics required for a complete answer to the question.
 * 2. Evaluates coverage across each source (covered / not_found / unclear).
 * 3. Topics not covered by ANY source become "potential gaps".
 */
export async function analyzeCoverage(
  question: string,
  sources: Source[]
): Promise<CoverageResult> {
  const callRecords: LlmCallRecord[] = [];
  const activeSources = sources.filter((s) => !s.fetchError && s.rawText.trim().length > 0);

  // Step 1: Generate checklist topics for the question
  const topicGenSystem = `You are an information completeness auditor.
Given a user's research question, produce a checklist of 6 to 10 distinct, critical topics that a complete, reliable answer MUST cover.
Output ONLY a JSON object with a "topics" array containing { "topic": string, "description": string }.`;

  const topicGenPrompt = `Research Question: "${question}"

Generate the 6-10 essential topics to evaluate across documentation sources.`;

  const topicRes = await generateJson({
    system: topicGenSystem,
    prompt: topicGenPrompt,
    schema: TopicChecklistLlmSchema,
    taskName: "generate_checklist_topics",
  });

  callRecords.push({
    task: "generate_checklist_topics",
    provider: topicRes.provider,
    model: topicRes.model,
    latencyMs: topicRes.latencyMs,
    usedFallback: topicRes.usedFallback,
  });

  const generatedTopics = topicRes.data.topics;

  // Step 2: Evaluate topics for each source
  // For each source, prompt LLM to mark covered, not_found, or unclear
  const evaluationsBySource: Map<
    string,
    Map<string, { status: "covered" | "not_found" | "unclear"; quote?: string }>
  > = new Map();

  for (const source of activeSources) {
    const evalSystem = `You are an objective auditor scoring document coverage.
Evaluate whether each listed topic is addressed in the provided source text.
For each topic, return:
- "topic": exact topic name
- "status": "covered" (clearly stated), "unclear" (ambiguous or partial mention), or "not_found" (not mentioned at all)
- "relevant_quote": exact quote supporting "covered" or "unclear", or null if "not_found"
- "explanation": brief note
Return ONLY a valid JSON object matching the schema with an "evaluations" array.`;

    const evalPrompt = `Source Name: "${source.name}"
Source Content:
\"\"\"
${source.rawText}
\"\"\"

Topics to evaluate:
${JSON.stringify(generatedTopics, null, 2)}
`;

    const evalRes = await generateJson({
      system: evalSystem,
      prompt: evalPrompt,
      schema: TopicEvaluationLlmSchema,
      taskName: `evaluate_coverage_${source.id}`,
    });

    callRecords.push({
      task: `evaluate_coverage_${source.id}`,
      provider: evalRes.provider,
      model: evalRes.model,
      latencyMs: evalRes.latencyMs,
      usedFallback: evalRes.usedFallback,
    });

    const topicMap = new Map<string, { status: "covered" | "not_found" | "unclear"; quote?: string }>();
    for (const ev of evalRes.data.evaluations) {
      topicMap.set(ev.topic.toLowerCase().trim(), {
        status: ev.status,
        quote: ev.relevant_quote || undefined,
      });
    }
    evaluationsBySource.set(source.id, topicMap);
  }

  // Step 3: Build the coverage matrix and detect potential gaps
  const matrixItems: CoverageMatrixItem[] = [];
  const gaps: Gap[] = [];

  for (let i = 0; i < generatedTopics.length; i++) {
    const t = generatedTopics[i];
    const tKey = t.topic.toLowerCase().trim();
    const sourceScores: Record<string, "covered" | "not_found" | "unclear"> = {};
    const quotes: Record<string, string | undefined> = {};

    let anyCoveredOrUnclear = false;

    for (const source of sources) {
      if (source.fetchError) {
        sourceScores[source.id] = "not_found";
        continue;
      }

      const score = evaluationsBySource.get(source.id)?.get(tKey);
      if (score) {
        sourceScores[source.id] = score.status;
        quotes[source.id] = score.quote;
        if (score.status === "covered" || score.status === "unclear") {
          anyCoveredOrUnclear = true;
        }
      } else {
        sourceScores[source.id] = "not_found";
      }
    }

    const isGap = !anyCoveredOrUnclear;

    matrixItems.push({
      topic: t.topic,
      topicDescription: t.description,
      sourceScores,
      quotes,
      isGap,
    });

    if (isGap) {
      const topicLower = t.topic.toLowerCase();
      const severity =
        topicLower.includes("deadline") ||
        topicLower.includes("eligibility") ||
        topicLower.includes("document")
          ? "high"
          : "medium";

      gaps.push({
        id: `gap_${i + 1}`,
        topic: t.topic,
        description: t.description,
        severity,
      });
    }
  }

  return {
    coverageMatrix: { topics: matrixItems },
    gaps,
    callRecords,
  };
}
