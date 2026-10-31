import { NextRequest, NextResponse } from "next/server";
import { AnalyzeRequestSchema, AnalysisResult } from "@/lib/types";
import { checkRateLimit } from "@/lib/rateLimit";
import { ingestAllSources } from "@/lib/ingest";
import { extractAllFacts } from "@/lib/extract";
import { verifyFactQuotes } from "@/lib/verifyQuotes";
import { analyzeCoverage } from "@/lib/coverage";
import { detectConflicts } from "@/lib/conflicts";
import { checkOutdatedInformation } from "@/lib/dates";
import { generateChecklist } from "@/lib/checklist";

export const maxDuration = 60; // Allow sufficient time for LLM calls if needed

export async function POST(req: NextRequest) {
  // 1. IP Rate Limiting Guard
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  const rateLimitStatus = checkRateLimit(ip);
  if (!rateLimitStatus.allowed) {
    return NextResponse.json(
      {
        code: "RATE_LIMITED",
        message: `Too many analysis requests. Please wait ${rateLimitStatus.retryAfterSeconds}s before trying again.`,
        retryAfter: rateLimitStatus.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitStatus.retryAfterSeconds || 60),
        },
      }
    );
  }

  // 2. Request Payload Validation with Zod
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", message: "Invalid JSON in request body." },
      { status: 400 }
    );
  }

  const parseResult = AnalyzeRequestSchema.safeParse(bodyJson);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        code: "VALIDATION_ERROR",
        message: "Invalid request parameters.",
        errors: parseResult.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { question, sources: sourceInputs } = parseResult.data;

  try {
    // 3. Step 1: INGEST
    const sources = await ingestAllSources(sourceInputs);

    // If all sources failed to fetch
    const validSources = sources.filter((s) => !s.fetchError && s.rawText.trim().length > 0);
    if (validSources.length === 0) {
      return NextResponse.json(
        {
          code: "ALL_SOURCES_FAILED",
          message: "All provided sources could not be loaded or were empty.",
          sources,
        },
        { status: 422 }
      );
    }

    const modelsUsedList = [];

    // 4. Step 2: EXTRACT FACTS
    const { facts: rawFacts, callRecords: extractRecords } = await extractAllFacts(sources, question);
    modelsUsedList.push(...extractRecords);

    // 5. Step 3: VERIFY QUOTES (Deterministic, no LLM)
    const verifiedFacts = verifyFactQuotes(rawFacts, sources);

    // 6. Step 4: COVERAGE CHECK & GAPS
    const { coverageMatrix, gaps, callRecords: coverageRecords } = await analyzeCoverage(
      question,
      sources
    );
    modelsUsedList.push(...coverageRecords);

    // 7. Step 5: CONFLICT DETECTION (Only verified facts)
    const { conflicts, callRecords: conflictRecords } = await detectConflicts(verifiedFacts, sources);
    modelsUsedList.push(...conflictRecords);

    // 8. Step 6: OUTDATED & UNDATED WARNINGS (Deterministic, no LLM)
    const outdatedWarnings = checkOutdatedInformation(verifiedFacts, sources, new Date());

    // 9. Step 7: CHECKLIST GENERATION (Deterministic, no LLM)
    const checklist = generateChecklist({
      conflicts,
      gaps,
      outdatedWarnings,
      sources,
    });

    const result: AnalysisResult = {
      question,
      analyzedAt: new Date().toISOString(),
      sources,
      facts: verifiedFacts,
      coverageMatrix,
      gaps,
      conflicts,
      outdatedWarnings,
      checklist,
      modelsUsed: modelsUsedList,
      isEmergencyFallback: false,
    };

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[/api/analyze] Pipeline error:", err);

    if (err.code === "LLM_UNAVAILABLE" || err.message?.includes("Both LLM providers failed")) {
      return NextResponse.json(
        {
          code: "LLM_UNAVAILABLE",
          message:
            "Live AI analysis is currently unavailable on both providers. You can review the pre-saved sample analysis.",
          details: err.message,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        code: "PIPELINE_ERROR",
        message: err.message || "An unexpected error occurred during analysis.",
      },
      { status: 500 }
    );
  }
}
