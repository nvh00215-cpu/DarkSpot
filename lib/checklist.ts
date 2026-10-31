import { ChecklistItem, Conflict, Gap, OutdatedWarning, Source } from "./types";

interface ChecklistParams {
  conflicts: Conflict[];
  gaps: Gap[];
  outdatedWarnings: OutdatedWarning[];
  sources: Source[];
}

/**
 * Generates a prioritized "verify next" action checklist:
 * - High Priority:
 *   - Conflicting information between sources
 *   - Missing deadline or missing required documents gaps
 * - Medium Priority:
 *   - Outdated dates, undated sources, or past cycle mentions
 * - Low Priority:
 *   - Other potential gaps (eligibility criteria, renewal, fees, contacts)
 */
export function generateChecklist({
  conflicts,
  gaps,
  outdatedWarnings,
  sources,
}: ChecklistParams): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const sourceNameMap = new Map(sources.map((s) => [s.id, s.name]));

  // 1. High Priority: Conflicts
  for (const c of conflicts) {
    items.push({
      id: `chk_conf_${c.id}`,
      priority: "High",
      title: `Resolve conflict on ${c.topic.replace(/_/g, " ")}`,
      action: `Contact the scholarship office directly to clarify conflicting information between "${c.sourceA.sourceName}" and "${c.sourceB.sourceName}".`,
      originType: "conflict",
      sourceReference: `${c.sourceA.sourceName} vs ${c.sourceB.sourceName}`,
      completed: false,
    });
  }

  // 2. High Priority: Gaps in Deadline or Required Documents
  for (const gap of gaps) {
    const topicLower = gap.topic.toLowerCase();
    const isHighPriorityGap =
      topicLower.includes("deadline") ||
      topicLower.includes("document") ||
      topicLower.includes("transcript") ||
      topicLower.includes("recommendation") ||
      topicLower.includes("submission date");

    if (isHighPriorityGap) {
      items.push({
        id: `chk_gap_hi_${gap.id}`,
        priority: "High",
        title: `Verify ${gap.topic}`,
        action: `Confirm the exact requirements/deadlines for "${gap.topic}" since none of the provided sources gave clear details.`,
        originType: topicLower.includes("deadline") ? "missing_deadline" : "missing_documents",
        sourceReference: "All sources",
        completed: false,
      });
    }
  }

  // 3. Medium Priority: Outdated or Undated Warnings
  for (const warn of outdatedWarnings) {
    items.push({
      id: `chk_warn_${warn.id}`,
      priority: "Medium",
      title: `Check freshness of ${warn.sourceName}`,
      action: `${warn.message} Ensure this information applies to the current application period.`,
      originType: "outdated",
      sourceReference: warn.sourceName,
      completed: false,
    });
  }

  // 4. Low Priority: Other potential gaps
  for (const gap of gaps) {
    const topicLower = gap.topic.toLowerCase();
    const isAlreadyAdded = items.some((i) => i.id === `chk_gap_hi_${gap.id}`);
    if (!isAlreadyAdded) {
      items.push({
        id: `chk_gap_lo_${gap.id}`,
        priority: "Low",
        title: `Clarify ${gap.topic}`,
        action: `Review whether you need clarification on "${gap.topic}" (${gap.description}) before completing your application.`,
        originType: "gap",
        sourceReference: "Identified gap",
        completed: false,
      });
    }
  }

  return items;
}
