import { generateJson } from "./llm";
import {
  CoverageMatrix,
  CoverageMatrixItem,
  Fact,
  FactCategory,
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
  facts: Fact[]; // Verified facts passed in
  outdatedWarnings: OutdatedWarning[];
}

interface CoverageResult {
  coverageMatrix: CoverageMatrix;
  gaps: Gap[];
  callRecords: LlmCallRecord[];
}

// Map standard categories to relevant keywords/topics
const CATEGORY_MAP: Record<string, FactCategory[]> = {
  eligibility: ["eligibility"],
  deadline: ["deadline"],
  required_documents: ["required_documents"],
  application_process: ["application_process"],
  renewal_conditions: ["renewal_conditions"],
  fees_or_amount: ["fees_or_amount"],
  contact: ["contact"],
};

export async function analyzeCoverage({
  question,
  sources,
  facts,
  outdatedWarnings,
}: CoverageParams): Promise<CoverageResult> {
  const callRecords: LlmCallRecord[] = [];
  const activeSources = sources.filter((s) => !s.fetchError && s.rawText.trim().length > 0);

  const outdatedSourceIds = new Set(
    outdatedWarnings.filter((w) => w.status === "outdated").map((w) => w.sourceId)
  );

  // Filter for verified facts only
  const verifiedFacts = facts.filter((f) => f.isVerified);

  // Build facts per source
  const factsBySourceId = new Map<string, Fact[]>();
  for (const s of sources) {
    factsBySourceId.set(s.id, []);
  }
  for (const f of verifiedFacts) {
    const list = factsBySourceId.get(f.sourceId) || [];
    list.push(f);
    factsBySourceId.set(f.sourceId, list);
  }

  // 1. TOPIC GENERATION:
  // ALWAYS include the 7 standard topics for scholarship-type questions, plus at most 3 question-specific topics.
  const standardTopics = [
    { topic: "Eligibility Criteria", category: "eligibility", description: "Academic standing, major, GPA, and applicant restrictions." },
    { topic: "Application Deadline", category: "deadline", description: "Submission cutoff date, time, and time zone." },
    { topic: "Required Documents", category: "required_documents", description: "Transcripts, letters of recommendation, tax forms, essays, etc." },
    { topic: "Application Process & Link", category: "application_process", description: "Official application submission link, registration portal, and steps." },
    { topic: "Renewal Conditions", category: "renewal_conditions", description: "Conditions required to renew the award in future semesters/years." },
    { topic: "Award Amount & Disbursement", category: "fees_or_amount", description: "Stipend amount, disbursement schedule, or fees." },
    { topic: "Contact Information", category: "contact", description: "Official email, support hotline, or inquiry contact for questions." },
  ];

  const topicGenSystem = `You are an information auditor for application queries.
The base requirements (eligibility, deadline, required documents, application process/link, renewal conditions, award amount, contact) are already standard.
Generate at most 2 or 3 additional distinct, critical, actionable requirements specific to the user's research question that an applicant should verify.
Return ONLY valid JSON matching the schema with a "topics" array containing at most 3 items: { "topic": string, "description": string }.`;

  const topicGenPrompt = `Research Question: "${question}"

Generate up to 3 additional actionable topics specific to this question (do not duplicate standard eligibility, deadlines, documents, award amount, process, renewal, or contact).`;

  let additionalTopics: Array<{ topic: string; description: string }> = [];
  try {
    const topicRes = await generateJson({
      system: topicGenSystem,
      prompt: topicGenPrompt,
      schema: TopicChecklistLlmSchema,
      taskName: "generate_additional_topics",
    });

    callRecords.push({
      task: "generate_additional_topics",
      provider: topicRes.provider,
      model: topicRes.model,
      latencyMs: topicRes.latencyMs,
      usedFallback: topicRes.usedFallback,
    });
    additionalTopics = topicRes.data.topics.slice(0, 3);
  } catch (err) {
    console.warn("Using standard topics fallback for coverage generation.");
  }

  // Combine standard topics with at most 3 additional topics
  const combinedTopics = [
    ...standardTopics.map((st) => ({
      topic: st.topic,
      description: st.description,
      standardCategory: st.category as FactCategory,
    })),
    ...additionalTopics.map((at) => ({
      topic: at.topic,
      description: at.description,
      standardCategory: undefined,
    })),
  ];

  // 2. EVALUATE COVERAGE:
  // For each source, pass in its verified extracted facts!
  const evaluationsBySource: Map<
    string,
    Map<string, { status: "covered" | "not_found" | "unclear"; quote?: string }>
  > = new Map();

  for (const source of activeSources) {
    const sourceFacts = factsBySourceId.get(source.id) || [];
    const sourceFactsSummary = sourceFacts.map((f) => ({
      category: f.category,
      value: f.value,
      quote: f.exact_quote,
    }));

    const evalSystem = `You are an auditor scoring topic coverage against a source and its verified facts.
CRITICAL RULES:
1. You are provided the source text AND its verified extracted facts.
2. If the source has a verified fact that directly answers or covers the topic, mark status "covered" and cite the fact's exact quote.
3. If the topic is partially mentioned without specifics, mark "unclear".
4. If neither the facts nor the text mention the topic, mark "not_found".
Return ONLY valid JSON with an "evaluations" array matching the schema.`;

    const evalPrompt = `Source Name: "${source.name}"
Verified Facts Extracted from this Source:
${JSON.stringify(sourceFactsSummary, null, 2)}

Full Source Text:
\"\"\"
${source.rawText}
\"\"\"

Topics to evaluate:
${JSON.stringify(combinedTopics.map((t) => ({ topic: t.topic, description: t.description })), null, 2)}
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

    // GROUND TRUTH RULE: If facts and coverage result disagree, TRUST THE FACTS.
    // If a source has verified facts in the category, ensure it is marked "covered" with the fact quote.
    for (const t of combinedTopics) {
      const tKey = t.topic.toLowerCase().trim();
      const cat = t.standardCategory;
      if (cat) {
        const matchingFacts = sourceFacts.filter((f) => f.category === cat);
        if (matchingFacts.length > 0) {
          const bestFact = matchingFacts[0];
          // Force covered if verified facts exist
          topicMap.set(tKey, {
            status: "covered",
            quote: bestFact.exact_quote,
          });
        }
      }
    }

    evaluationsBySource.set(source.id, topicMap);
  }

  // 3. BUILD MATRIX & ASSIGN STATUS:
  const matrixItems: CoverageMatrixItem[] = [];
  const gaps: Gap[] = [];

  for (let i = 0; i < combinedTopics.length; i++) {
    const t = combinedTopics[i];
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
      note = "Not covered by any reviewed sources";
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
      // Determine severity: critical categories = high
      const topicLower = t.topic.toLowerCase();
      const isCritical =
        topicLower.includes("deadline") ||
        topicLower.includes("document") ||
        topicLower.includes("process") ||
        topicLower.includes("link") ||
        topicLower.includes("renewal") ||
        topicLower.includes("amount") ||
        topicLower.includes("eligibility");

      const severity = isCritical ? "high" : "low";

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
