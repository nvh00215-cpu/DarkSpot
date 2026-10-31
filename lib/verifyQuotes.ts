import { Fact, Source } from "./types";

/**
 * Normalizes text for comparison:
 * - strips punctuation and converts to lowercase
 * - collapses all consecutive whitespaces into a single space
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculates token overlap similarity between two strings (0.0 to 1.0)
 */
function tokenSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(b.split(" ").filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let common = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) common++;
  }

  return common / Math.max(wordsA.size, wordsB.size);
}

/**
 * Verifies that each exact_quote actually appears in the corresponding source text.
 * Rule:
 * 1. Normalize whitespace and case.
 * 2. Check exact substring match.
 * 3. If exact substring match fails, check fuzzy token match (> 0.75 match).
 * 4. If neither matches, mark isVerified = false.
 */
export function verifyFactQuotes(facts: Fact[], sources: Source[]): Fact[] {
  const sourceMap = new Map<string, string>();
  for (const s of sources) {
    sourceMap.set(s.id, s.rawText);
  }

  return facts.map((fact) => {
    const rawSourceText = sourceMap.get(fact.sourceId) || "";
    if (!rawSourceText || !fact.exact_quote) {
      return {
        ...fact,
        isVerified: false,
        verificationNote: "Source text or quote is missing.",
      };
    }

    const normQuote = normalizeText(fact.exact_quote);
    const normSource = normalizeText(rawSourceText);

    // 1. Direct normalized substring check
    if (normSource.includes(normQuote)) {
      return {
        ...fact,
        isVerified: true,
      };
    }

    // 2. Sliding window fuzzy token check for minor OCR / character formatting differences
    const quoteWords = normQuote.split(" ");
    const quoteLen = quoteWords.length;

    if (quoteLen >= 4) {
      const sourceWords = normSource.split(" ");
      let bestSim = 0;

      for (let i = 0; i <= sourceWords.length - quoteLen; i += Math.max(1, Math.floor(quoteLen / 2))) {
        const windowText = sourceWords.slice(i, i + quoteLen).join(" ");
        const sim = tokenSimilarity(normQuote, windowText);
        if (sim > bestSim) bestSim = sim;
        if (bestSim >= 0.8) break;
      }

      if (bestSim >= 0.75) {
        return {
          ...fact,
          isVerified: true,
          verificationNote: `Fuzzy matched with ${(bestSim * 100).toFixed(0)}% token alignment.`,
        };
      }
    }

    return {
      ...fact,
      isVerified: false,
      verificationNote: "Quote was not found verbatim in the source text.",
    };
  });
}
