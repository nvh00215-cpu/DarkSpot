import { z } from "zod";
import { callGemini } from "./providers/gemini";
import { callGroq } from "./providers/groq";

export interface GenerateJsonParams<T> {
  system?: string;
  prompt: string;
  schema: z.ZodType<T>;
  taskName?: string;
}

export interface GenerateJsonResult<T> {
  data: T;
  provider: "gemini" | "groq";
  model: string;
  latencyMs: number;
  usedFallback: boolean;
}

// In-memory cooldown tracker (60 seconds) for primary provider when 429/quota error occurs
let primaryCooldownUntil = 0;

export function extractJsonFromText(rawText: string): any {
  let cleaned = rawText.trim();
  // Strip markdown code fences if present (e.g. ```json ... ``` or ``` ...)
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }

  // If there's extra narrative surrounding the JSON, attempt to locate the first outer { or [
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  let startIdx = -1;

  if (firstBrace !== -1 && firstBracket !== -1) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  }

  if (startIdx > -1) {
    const isObject = cleaned[startIdx] === "{";
    const endChar = isObject ? "}" : "]";
    const lastIdx = cleaned.lastIndexOf(endChar);
    if (lastIdx > startIdx) {
      cleaned = cleaned.substring(startIdx, lastIdx + 1);
    }
  }

  return JSON.parse(cleaned);
}

function shouldFailover(err: any): boolean {
  const status = Number(err?.status || err?.statusCode || 0);

  // Do NOT failover on 400 (bad request) or 401/403 (invalid key / unauthorized)
  if (status === 400 || status === 401 || status === 403) {
    console.error(`[LLM Config/Auth Error] Permanent error HTTP ${status}: ${err.message}`);
    return false;
  }

  // Fail over on 429 (rate limit/quota), timeouts (504 or message), 5xx server errors, network errors
  if (
    status === 429 ||
    status === 504 ||
    (status >= 500 && status < 600) ||
    err.name === "AbortError" ||
    err.message?.includes("fetch failed") ||
    err.message?.includes("timed out") ||
    err.message?.includes("quota") ||
    err.message?.includes("RESOURCE_EXHAUSTED") ||
    err.isJsonParseError
  ) {
    return true;
  }

  // Default to failover for unexpected runtime exceptions
  return true;
}

export async function generateJson<T>(params: GenerateJsonParams<T>): Promise<GenerateJsonResult<T>> {
  const primaryPref = (process.env.LLM_PRIMARY || "gemini").toLowerCase();
  const forceFailover = process.env.FORCE_FAILOVER === "true";

  const primaryProvider: "gemini" | "groq" = primaryPref === "groq" ? "groq" : "gemini";
  const secondaryProvider: "gemini" | "groq" = primaryProvider === "gemini" ? "groq" : "gemini";

  const callProvider = async (provider: "gemini" | "groq") => {
    if (provider === "gemini") {
      return await callGemini({ system: params.system, prompt: params.prompt });
    } else {
      return await callGroq({ system: params.system, prompt: params.prompt });
    }
  };

  const executeWithValidation = async (provider: "gemini" | "groq", attempt = 1): Promise<{ data: T; model: string }> => {
    const result = await callProvider(provider);
    try {
      const parsed = extractJsonFromText(result.text);
      const validated = params.schema.parse(parsed);
      return { data: validated, model: result.model };
    } catch (parseOrValidationError: any) {
      if (attempt === 1) {
        console.warn(`[LLM ${provider}] Invalid JSON received. Retrying once with ${provider}...`);
        return await executeWithValidation(provider, 2);
      }
      const err: any = new Error(
        `Failed to parse/validate JSON from ${provider} after retry: ${parseOrValidationError.message}`
      );
      err.isJsonParseError = true;
      throw err;
    }
  };

  const startTime = Date.now();
  const now = Date.now();
  const primaryInCooldown = now < primaryCooldownUntil;

  // Check if we should attempt primary
  if (!forceFailover && !primaryInCooldown) {
    try {
      const { data, model } = await executeWithValidation(primaryProvider);
      return {
        data,
        provider: primaryProvider,
        model,
        latencyMs: Date.now() - startTime,
        usedFallback: false,
      };
    } catch (primaryErr: any) {
      console.warn(`[LLM] Primary provider (${primaryProvider}) failed: ${primaryErr.message}`);

      // Set 60-second cooldown on quota / 429
      if (
        primaryErr.status === 429 ||
        primaryErr.message?.includes("quota") ||
        primaryErr.message?.includes("RESOURCE_EXHAUSTED")
      ) {
        console.warn(`[LLM] Setting 60-second cooldown for primary provider (${primaryProvider}).`);
        primaryCooldownUntil = Date.now() + 60000;
      }

      if (!shouldFailover(primaryErr)) {
        throw primaryErr;
      }
    }
  } else if (forceFailover) {
    console.info("[LLM] FORCE_FAILOVER=true is set. Skipping primary provider.");
  } else if (primaryInCooldown) {
    console.info(`[LLM] Primary provider in cooldown for another ${Math.round((primaryCooldownUntil - now) / 1000)}s.`);
  }

  // Attempt Secondary Provider Failover
  const secondaryKey = secondaryProvider === "gemini" ? process.env.GEMINI_API_KEY : process.env.GROQ_API_KEY;
  if (!secondaryKey) {
    console.error(`[LLM] Secondary provider (${secondaryProvider}) API key is missing. Skipping failover.`);
    const err: any = new Error(
      `Primary provider failed and secondary provider (${secondaryProvider}) API key is missing.`
    );
    err.code = "LLM_UNAVAILABLE";
    throw err;
  }

  console.info(`[LLM] Failing over to secondary provider (${secondaryProvider})...`);
  try {
    const { data, model } = await executeWithValidation(secondaryProvider);
    return {
      data,
      provider: secondaryProvider,
      model,
      latencyMs: Date.now() - startTime,
      usedFallback: true,
    };
  } catch (secondaryErr: any) {
    console.error(`[LLM] Secondary provider (${secondaryProvider}) also failed: ${secondaryErr.message}`);
    const finalErr: any = new Error(
      `Both LLM providers failed. Primary: ${primaryProvider}, Secondary: ${secondaryProvider}. Details: ${secondaryErr.message}`
    );
    finalErr.code = "LLM_UNAVAILABLE";
    throw finalErr;
  }
}
