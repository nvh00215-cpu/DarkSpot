import { generateJson } from "./llm";
import {
  CoverageMatrix,
  CoverageMatrixItem,
  Gap,
  LlmCallRecord,
  OutdatedWarning,
  Source,
  TopicChecklistLlmSchema,
  TopicEvaluationLlmSchema,
  TopicOverallStatus,
} from "./types";

interface CoverageParams {
  question: string;
  sources: Source[];
  outdatedWarnings: OutdatedWarning[];
}

interface CoverageResult {
  coverageMatrix: CoverageMatrix;
  gaps: Gap[];
  callRecords: LlmCallRecord[];
}

/**
 * Evaluates coverage and flags information gaps:
 * - A topic only counts as "covered" if at least one CURRENT source (not flagged outdated/past-cycle) marks it covered.
 * - If covered only by outdated sources, status = "covered_only_by_outdated" and it becomes a potential gap with note "Only found in an outdated source".
 * - If no source marks it covered, status = "potential_gap".
 */
export async function analyzeCoverage({
  question,
  sources,
  outdatedWarnings,
}: CoverageParams): Promise<CoverageResult> {
  const callRecords: LlmCallRecord[] = [];
  const activeSources = sources.filter((s) => !s.fetchError && s.rawText.trim().length > 0);

  // Map outdated source IDs
  const outdatedSourceIds = new Set(
    outdatedWarnings.filter((w) => w.status === "outdated").map((w) => w.sourceId)
  );

  // Step 1: Generate checklist topics for the question (Actionable items only)
  const topicGenSystem = `You are a scholarship and application requirements auditor.
Given a user's research question, generate 6 to 10 distinct, critical, actionable requirements that an applicant must act on, submit, or verify before applying.

RULES:
- Focus STRICTLY on actionable requirements: eligibility thresholds, required documents, application procedures, deadlines, renewal conditions, financial amounts, and contact channels.
- DO NOT generate topics about historical statistics, recipient career outcomes, or general alumni outcomes.
- Return ONLY a JSON object with a "topics" array containing { "topic": string, "description": string }.`;

  const topicGenPrompt = `Research Question: "${question}"

Generate 6-10 essential, actionable checklist topics that an applicant needs to act on or verify.`;

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

  // Step 2: Evaluate topics across each source
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

  // Step 3: Build coverage matrix with current vs outdated distinction
  const matrixItems: CoverageMatrixItem[] = [];
  const gaps: Gap[] = [];

  for (let i = 0; i < generatedTopics.length; i++) {
    const t = generatedTopics[i];
    const tKey = t.topic.toLowerCase().trim();
    const sourceScores: Record<string, "covered" | "not_found" | "unclear"> = {};
    const quotes: Record<string, string | undefined> = {};

    let coveredByCurrent = false;
    let coveredByOutdated = false;

    for (const source of sources) {
      if (source.fetchError) {
        sourceScores[source.id] = "not_found";
        continue;
      }

      const score = evaluationsBySource.get(source.id)?.get(tKey);
      const isOutdatedSource = outdatedSourceIds.has(source.id);

      if (score) {
        sourceScores[source.id] = score.status;
        quotes[source.id] = score.quote;

        if (score.status === "covered") {
          if (isOutdatedSource) {
            coveredByOutdated = true;
          } else {
            coveredByCurrent = true;
          }
        }
      } else {
        sourceScores[source.id] = "not_found";
      }
    }

    let overallStatus: TopicOverallStatus;
    let note: string | undefined;
    let isGap = false;

    if (coveredByCurrent) {
      overallStatus = "covered";
    } else if (coveredByOutdated) {
      overallStatus = "covered_only_by_outdated";
      note = "Only found in an outdated source";
      isGap = true;
    } else {
      overallStatus = "potential_gap";
      note = "Not covered by any of the reviewed sources";
      isGap = true;
    }

    matrixItems.push({
      topic: t.topic,
      topicDescription: t.description,
      status: overallStatus,
      sourceScores,
      quotes,
      note,
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
        gapType:
          overallStatus === "covered_only_by_outdated"
            ? "only_found_in_outdated_source"
            : "missing_from_all_sources",
        note: note || "Information gap detected across sources",
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
