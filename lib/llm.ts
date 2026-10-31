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

/**
 * Strips markdown code fences (```json ... ```) and extracts the first {...} or [...] block before JSON parsing.
 */
export function extractJsonFromText(rawText: string): any {
  if (!rawText) {
    throw new Error("Cannot parse empty response from LLM.");
  }

  let cleaned = rawText.trim();

  // Strip code fences
  if (cleaned.includes("```")) {
    cleaned = cleaned.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, "$1").trim();
  }

  // Extract the outermost JSON structure (object or array)
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");

  let startIdx = -1;
  let isObject = false;

  if (firstBrace !== -1 && firstBracket !== -1) {
    if (firstBrace < firstBracket) {
      startIdx = firstBrace;
      isObject = true;
    } else {
      startIdx = firstBracket;
      isObject = false;
    }
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
    isObject = true;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    isObject = false;
  }

  if (startIdx > -1) {
    const endChar = isObject ? "}" : "]";
    const lastIdx = cleaned.lastIndexOf(endChar);
    if (lastIdx > startIdx) {
      cleaned = cleaned.substring(startIdx, lastIdx + 1);
    }
  }

  return JSON.parse(cleaned);
}

export async function generateJson<T>(params: GenerateJsonParams<T>): Promise<GenerateJsonResult<T>> {
  // Default to Groq as primary provider
  const primaryPref = (process.env.LLM_PRIMARY || "groq").toLowerCase();
  const forceFailover = process.env.FORCE_FAILOVER === "true";

  const primaryProvider: "gemini" | "groq" = primaryPref === "gemini" ? "gemini" : "groq";
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

  // Attempt Primary Provider
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
      console.warn(
        `[LLM Failover Triggered] Primary provider (${primaryProvider}) failed with error [status=${primaryErr.status || "N/A"}]: ${primaryErr.message}`
      );

      // 60-second cooldown on quota / 429
      if (
        primaryErr.status === 429 ||
        primaryErr.message?.includes("quota") ||
        primaryErr.message?.includes("RESOURCE_EXHAUSTED")
      ) {
        console.warn(`[LLM] Setting 60s cooldown for ${primaryProvider}.`);
        primaryCooldownUntil = Date.now() + 60000;
      }
      // Fail over to secondary on ANY failure (including 400, 401, 403, 404, timeouts, parse errors)
    }
  } else if (forceFailover) {
    console.info("[LLM] FORCE_FAILOVER=true is active. Skipping primary provider.");
  } else if (primaryInCooldown) {
    console.info(`[LLM] Primary provider (${primaryProvider}) in cooldown for another ${Math.round((primaryCooldownUntil - now) / 1000)}s.`);
  }

  // Attempt Secondary Provider Failover
  const secondaryKey = secondaryProvider === "gemini" ? process.env.GEMINI_API_KEY : process.env.GROQ_API_KEY;
  if (!secondaryKey) {
    console.error(`[LLM] Secondary provider (${secondaryProvider}) API key is missing. Skipping failover.`);
    const err: any = new Error(
      `Primary provider (${primaryProvider}) failed and secondary (${secondaryProvider}) API key is missing.`
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
