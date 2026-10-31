import { Fact, OutdatedWarning, Source } from "./types";

/**
 * Checks for outdated or undated information in facts and sources.
 * Rules:
 * 1. Parse date mentions in facts and source text.
 * 2. Flag any fact or source referencing a date older than 12 months from the current date.
 * 3. Flag any source that has no visible date mentions (undated source warning).
 * 4. Flag any explicit mentions of past cycles (e.g. "2023-2024 cycle", "last year's deadline", "past deadline").
 */
export function checkOutdatedInformation(
  facts: Fact[],
  sources: Source[],
  currentDate = new Date()
): OutdatedWarning[] {
  const warnings: OutdatedWarning[] = [];
  const currentYear = currentDate.getFullYear();
  const twelveMonthsAgo = new Date(currentDate.getTime() - 365 * 24 * 60 * 60 * 1000);

  // Pattern for extracting 4-digit years (e.g., 2018 to 2035)
  const yearRegex = /\b(20[12]\d)\b/g;

  // Pattern for cycle keywords e.g. "2023-2024 cycle", "2022/2023 academic year"
  const pastCycleRegex = /\b(20\d{2})\s*[-/]\s*(20\d{2})\s*(cycle|academic year|session|award)/i;

  for (const source of sources) {
    if (source.fetchError) continue;

    const sourceText = source.rawText;
    const yearsInSource = Array.from(sourceText.matchAll(yearRegex), (m) => parseInt(m[1], 10));

    // 1. Check for past cycle mentions
    const cycleMatch = sourceText.match(pastCycleRegex);
    if (cycleMatch) {
      const endYear = parseInt(cycleMatch[2], 10);
      if (endYear < currentYear) {
        warnings.push({
          id: `warn_cycle_${source.id}`,
          sourceId: source.id,
          sourceName: source.name,
          detectedDate: `${cycleMatch[1]}-${cycleMatch[2]}`,
          warningType: "past_cycle_reference",
          message: `Source refers to a past application cycle (${cycleMatch[0]}). Criteria or dates may no longer be active.`,
          quote: cycleMatch[0],
        });
      }
    }

    // 2. Check for undated source
    if (yearsInSource.length === 0) {
      warnings.push({
        id: `warn_undated_${source.id}`,
        sourceId: source.id,
        sourceName: source.name,
        detectedDate: null,
        warningType: "undated_source",
        message: `No publication or cycle date found in source "${source.name}". Information may be unmaintained.`,
      });
    }

    // 3. Check for distinctly outdated years in source (e.g., source only refers to past years < currentYear)
    if (yearsInSource.length > 0) {
      const maxYear = Math.max(...yearsInSource);
      if (maxYear < currentYear) {
        // Only add if not already flagged as past cycle
        const alreadyFlagged = warnings.some(
          (w) => w.sourceId === source.id && w.warningType === "past_cycle_reference"
        );
        if (!alreadyFlagged) {
          warnings.push({
            id: `warn_oldyear_${source.id}`,
            sourceId: source.id,
            sourceName: source.name,
            detectedDate: `${maxYear}`,
            warningType: "older_than_12_months",
            message: `Most recent year mentioned in source is ${maxYear}, which is older than the current year (${currentYear}).`,
          });
        }
      }
    }
  }

  // 4. Check individual facts for outdated dates
  for (const fact of facts) {
    if (!fact.date_mentioned) continue;

    // Try parsing date string
    const parsedDate = new Date(fact.date_mentioned);
    if (!isNaN(parsedDate.getTime())) {
      if (parsedDate < twelveMonthsAgo) {
        warnings.push({
          id: `warn_fact_${fact.id}`,
          sourceId: fact.sourceId,
          sourceName: `Fact in ${fact.category}`,
          detectedDate: fact.date_mentioned,
          warningType: "older_than_12_months",
          message: `Fact (${fact.category}: "${fact.value.substring(0, 50)}...") references a date older than 12 months (${fact.date_mentioned}).`,
          quote: fact.exact_quote,
        });
      }
    } else {
      // Check for standalone 4-digit past year in date_mentioned string
      const match = fact.date_mentioned.match(/\b(20[12]\d)\b/);
      if (match) {
        const year = parseInt(match[1], 10);
        if (year < currentYear) {
          warnings.push({
            id: `warn_fact_yr_${fact.id}`,
            sourceId: fact.sourceId,
            sourceName: `Fact in ${fact.category}`,
            detectedDate: match[1],
            warningType: "older_than_12_months",
            message: `Fact references past year ${year} ("${fact.value.substring(0, 50)}..."). Verify current validity.`,
            quote: fact.exact_quote,
          });
        }
      }
    }
  }

  return warnings;
}
