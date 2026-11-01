import { Source, SourceInput } from "./types";

const MAX_SOURCE_CHARS = 15000;
const FETCH_TIMEOUT_MS = 30000;

/**
 * Ingests a single source:
 * - If text: truncates if exceeds 15,000 characters and returns Source object.
 * - If URL: fetches clean markdown/text via Jina Reader (https://r.jina.ai/<url>),
 *   handles timeout, blocking, or empty responses gracefully without failing the batch.
 */
export async function ingestSource(input: SourceInput, index: number): Promise<Source> {
  const id = `src_${index + 1}`;

  if (input.type === "text") {
    const rawText = input.text.trim();
    const truncated = rawText.length > MAX_SOURCE_CHARS;
    const cleanText = truncated ? rawText.substring(0, MAX_SOURCE_CHARS) : rawText;

    return {
      id,
      name: input.name || `Pasted Source ${index + 1}`,
      type: "text",
      rawText: cleanText,
      truncated,
    };
  }

  // URL ingestion using Jina Reader
  const targetUrl = input.url;
  const name = input.name || new URL(targetUrl).hostname;
  const jinaUrl = `https://r.jina.ai/${targetUrl}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(jinaUrl, {
      method: "GET",
      headers: {
        "Accept": "text/plain",
        "User-Agent": "DarkSpot-Reader/1.0",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        id,
        name,
        type: "url",
        url: targetUrl,
        rawText: "",
        truncated: false,
        fetchError: `Failed to fetch URL (HTTP ${response.status}: ${response.statusText})`,
      };
    }

    const fetchedText = await response.text();
    const trimmed = fetchedText.trim();

    if (!trimmed) {
      return {
        id,
        name,
        type: "url",
        url: targetUrl,
        rawText: "",
        truncated: false,
        fetchError: "Fetched page returned empty content.",
      };
    }

    const truncated = trimmed.length > MAX_SOURCE_CHARS;
    const cleanText = truncated ? trimmed.substring(0, MAX_SOURCE_CHARS) : trimmed;

    return {
      id,
      name,
      type: "url",
      url: targetUrl,
      rawText: cleanText,
      truncated,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === "AbortError" || controller.signal.aborted;
    return {
      id,
      name,
      type: "url",
      url: targetUrl,
      rawText: "",
      truncated: false,
      fetchError: isTimeout
        ? "Fetching source timed out after 30 seconds."
        : `Network error fetching source: ${err.message}`,
    };
  }
}

/**
 * Ingests all sources in parallel, preserving order and handling individual failures.
 */
export async function ingestAllSources(inputs: SourceInput[]): Promise<Source[]> {
  return Promise.all(inputs.map((input, idx) => ingestSource(input, idx)));
}
