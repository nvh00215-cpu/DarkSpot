import { GoogleGenAI } from "@google/genai";

export interface ProviderCallParams {
  system?: string;
  prompt: string;
  model?: string;
}

export interface ProviderCallResult {
  text: string;
  provider: "gemini";
  model: string;
}

export async function callGemini(params: ProviderCallParams): Promise<ProviderCallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error: any = new Error("GEMINI_API_KEY is missing in environment variables.");
    error.status = 401;
    throw error;
  }

  const model = params.model || process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const ai = new GoogleGenAI({ apiKey });

  // 30-second timeout guard
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const fullPrompt = params.system
      ? `System instructions:\n${params.system}\n\nTask:\n${params.prompt}`
      : params.prompt;

    const response = await ai.models.generateContent({
      model,
      contents: fullPrompt,
    });

    clearTimeout(timeoutId);

    const text = response.text || "";
    if (!text) {
      throw new Error("Empty response received from Gemini.");
    }

    return {
      text,
      provider: "gemini",
      model,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === "AbortError" || controller.signal.aborted) {
      const timeoutErr: any = new Error("Gemini call timed out after 30 seconds.");
      timeoutErr.status = 504;
      throw timeoutErr;
    }

    // Inspect error codes / messages for status mapping
    const status = err.status || err.statusCode || (err.message?.includes("429") ? 429 : 500);
    err.status = status;
    throw err;
  }
}
