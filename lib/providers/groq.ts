export interface GroqCallParams {
  system?: string;
  prompt: string;
  model?: string;
}

export interface GroqCallResult {
  text: string;
  provider: "groq";
  model: string;
}

export async function callGroq(params: GroqCallParams): Promise<GroqCallResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const error: any = new Error("GROQ_API_KEY is missing in environment variables.");
    error.status = 401;
    throw error;
  }

  const model = params.model || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (params.system) {
    messages.push({ role: "system", content: params.system });
  }
  messages.push({ role: "user", content: params.prompt });

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorBody = await res.text();
      const err: any = new Error(`Groq API returned HTTP ${res.status}: ${errorBody}`);
      err.status = res.status;
      throw err;
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content || "";
    if (!text) {
      throw new Error("Empty response received from Groq.");
    }

    return {
      text,
      provider: "groq",
      model,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === "AbortError" || controller.signal.aborted) {
      const timeoutErr: any = new Error("Groq call timed out after 30 seconds.");
      timeoutErr.status = 504;
      throw timeoutErr;
    }

    if (!err.status) {
      err.status = 500;
    }
    throw err;
  }
}
