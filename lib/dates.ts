import { Fact, OutdatedEvidence, OutdatedWarning, Source } from "./types";

/**
 * Checks for outdated or undated information in facts and sources.
 * Groups warnings per source (one entry per source with a list of evidence quotes).
 * Flags any source with no visible date as "undated".
 */
export function checkOutdatedInformation(
  facts: Fact[],
  sources: Source[],
  currentDate = new Date()
): OutdatedWarning[] {
  const warnings: OutdatedWarning[] = [];
  const currentYear = currentDate.getFullYear();
  const twelveMonthsAgo = new Date(currentDate.getTime() - 365 * 24 * 60 * 60 * 1000);

  const yearRegex = /\b(20[12]\d)\b/g;
  const pastCycleRegex = /\b(20\d{2})\s*[-/]\s*(20\d{2})\s*(cycle|academic year|session|award|cohort)/i;

  for (const source of sources) {
    if (source.fetchError) continue;

    const sourceText = source.rawText;
    const yearsInSource = Array.from(sourceText.matchAll(yearRegex), (m) => parseInt(m[1], 10));
    const evidenceList: OutdatedEvidence[] = [];

    // 1. Check for past cycle mentions in the source text
    const cycleMatch = sourceText.match(pastCycleRegex);
    if (cycleMatch) {
      const endYear = parseInt(cycleMatch[2], 10);
      if (endYear < currentYear) {
        evidenceList.push({
          detectedDate: `${cycleMatch[1]}-${cycleMatch[2]}`,
          evidenceType: "past_cycle_reference",
          quote: cycleMatch[0],
          message: `Refers to past application cycle (${cycleMatch[0]}). Criteria and deadlines are likely closed or altered.`,
        });
      }
    }

    // 2. Check individual facts belonging to this source for outdated dates
    const sourceFacts = facts.filter((f) => f.sourceId === source.id);
    for (const fact of sourceFacts) {
      if (!fact.date_mentioned) continue;

      const parsedDate = new Date(fact.date_mentioned);
      if (!isNaN(parsedDate.getTime())) {
        if (parsedDate < twelveMonthsAgo) {
          evidenceList.push({
            detectedDate: fact.date_mentioned,
            evidenceType: "older_than_12_months",
            quote: fact.exact_quote,
            message: `Fact (${fact.category}) references date older than 12 months (${fact.date_mentioned}).`,
          });
        }
      } else {
        const match = fact.date_mentioned.match(/\b(20[12]\d)\b/);
        if (match) {
          const yr = parseInt(match[1], 10);
          if (yr < currentYear) {
            evidenceList.push({
              detectedDate: match[1],
              evidenceType: "older_than_12_months",
              quote: fact.exact_quote,
              message: `Fact (${fact.category}) mentions past year ${yr}.`,
            });
          }
        }
      }
    }

    // 3. Determine status: outdated, undated, or current
    if (evidenceList.length > 0) {
      warnings.push({
        id: `outdated_${source.id}`,
        sourceId: source.id,
        sourceName: source.name,
        status: "outdated",
        summary: `Source refers to outdated cycles or dates older than 12 months. Do not rely on it as active guidance.`,
        evidenceList,
      });
    } else if (yearsInSource.length === 0) {
      warnings.push({
        id: `undated_${source.id}`,
        sourceId: source.id,
        sourceName: source.name,
        status: "undated",
        summary: `No publication or cycle date found in "${source.name}". Information may be unmaintained or from an unknown period.`,
        evidenceList: [],
      });
    } else {
      warnings.push({
        id: `current_${source.id}`,
        sourceId: source.id,
        sourceName: source.name,
        status: "current",
        summary: `Source contains current cycle dates or years (${Math.max(...yearsInSource)}).`,
        evidenceList: [],
      });
    }
  }

  return warnings;
}
