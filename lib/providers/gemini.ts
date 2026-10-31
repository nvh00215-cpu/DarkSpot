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

  // Enforce a hard 30-second timeout using AbortController on fetch
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 30000);

  try {
    const fullPrompt = params.system
      ? `${params.system}\n\n${params.prompt}`
      : params.prompt;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const requestBody: any = {
      contents: [
        {
          role: "user",
          parts: [{ text: fullPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
      },
    };

    // Only attach thinkingConfig if using a model known to require/support it
    if (model.includes("2.5") || model.includes("2.0-flash-thinking")) {
      requestBody.generationConfig.thinkingConfig = {
        thinkingBudget: 0,
      };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      // If thinkingConfig caused a 400 invalid argument on models that don't support thinkingConfig (e.g. gemini-1.5-flash), retry once without it
      if (res.status === 400 && requestBody.generationConfig.thinkingConfig) {
        delete requestBody.generationConfig.thinkingConfig;
        const retryRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          const retryText = retryData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          return { text: retryText, provider: "gemini", model };
        }
      }

      const errText = await res.text();
      const err: any = new Error(`Gemini API returned HTTP ${res.status}: ${errText}`);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const textPart = candidate?.content?.parts?.[0]?.text || "";

    if (!textPart) {
      throw new Error("Empty response received from Gemini.");
    }

    return {
      text: textPart,
      provider: "gemini",
      model,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === "AbortError" || controller.signal.aborted) {
      const timeoutErr: any = new Error("Gemini call timed out after hard 30-second limit.");
      timeoutErr.status = 504;
      throw timeoutErr;
    }

    if (!err.status) {
      err.status = 500;
    }
    throw err;
  }
}
