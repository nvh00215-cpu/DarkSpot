import { ChecklistItem, Conflict, Gap, OutdatedWarning, Source } from "./types";

interface ChecklistParams {
  conflicts: Conflict[];
  gaps: Gap[];
  outdatedWarnings: OutdatedWarning[];
  sources: Source[];
}

/**
 * Generates a prioritized action checklist according to strict priority rules:
 * - HIGH PRIORITY:
 *   1. Mandatory official baseline verification (deadline, official doc list, official link).
 *   2. Possible conflicts between current sources.
 *   3. Critical gaps (missing from all sources OR covered only by outdated sources) in:
 *      - deadline
 *      - required documents
 *      - application process / link
 *      - renewal conditions
 *      - award amount
 * - MEDIUM PRIORITY:
 *   1. Cycle differences (differences involving an outdated source, like GPA 3.65 vs 3.50 or Amount $12,500 vs $10,000).
 *   2. Outdated / undated source warnings.
 * - LOW PRIORITY:
 *   1. Any other non-critical gaps (e.g. contact info, general advice, additional custom topics).
 */
export function generateChecklist({
  conflicts,
  gaps,
  outdatedWarnings,
  sources,
}: ChecklistParams): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  // 1. Mandatory Baseline Item (Always High)
  items.push({
    id: "chk_baseline_official",
    priority: "High",
    title: "Verify official portal submission details",
    action: "Confirm the current deadline, official document list, and official application link from the official source.",
    originType: "baseline_verification",
    sourceReference: "Official Source Baseline",
    completed: false,
  });

  // 2. High Priority: Possible Conflicts between CURRENT sources
  const currentConflicts = conflicts.filter((c) => c.type === "possible_conflict");
  for (const c of currentConflicts) {
    items.push({
      id: `chk_conf_${c.id}`,
      priority: "High",
      title: `Resolve contradiction on ${c.topic}`,
      action: `Contact the scholarship office directly to clarify conflicting statements between "${c.sourceA.sourceName}" and "${c.sourceB.sourceName}".`,
      originType: "conflict",
      sourceReference: `${c.sourceA.sourceName} vs ${c.sourceB.sourceName}`,
      completed: false,
    });
  }

  // Helper to determine if a gap is in a critical category
  const isCriticalGap = (topic: string): boolean => {
    const t = topic.toLowerCase();
    return (
      t.includes("deadline") ||
      t.includes("document") ||
      t.includes("application") ||
      t.includes("link") ||
      t.includes("process") ||
      t.includes("renewal") ||
      t.includes("award") ||
      t.includes("amount") ||
      t.includes("eligibility")
    );
  };

  // 3. High Priority: Critical Gaps (both missing from all AND covered only by outdated)
  const criticalGaps = gaps.filter((g) => isCriticalGap(g.topic));
  for (const gap of criticalGaps) {
    let actionText = "";
    if (gap.gapType === "only_found_in_outdated_source") {
      actionText = `${gap.topic} is only mentioned in an outdated/archived source. Check the official current notice to see if renewal or requirements still apply.`;
    } else {
      actionText = `${gap.topic} was not found in any reviewed sources. Inquire with the scholarship administrator before submitting.`;
    }

    items.push({
      id: `chk_gap_crit_${gap.id}`,
      priority: "High",
      title: `Clarify ${gap.topic}`,
      action: actionText,
      originType: "gap",
      sourceReference: gap.gapType === "only_found_in_outdated_source" ? "Outdated Source Only" : "Missing from all sources",
      completed: false,
    });
  }

  // 4. Medium Priority: Cycle Differences (outdated source vs current source)
  const cycleDiffs = conflicts.filter((c) => c.type === "cycle_difference");
  for (const c of cycleDiffs) {
    items.push({
      id: `chk_cycle_${c.id}`,
      priority: "Medium",
      title: `Verify cycle update for ${c.topic}`,
      action: `Criteria appears to have evolved from older guidelines (${c.sourceA.isOutdated ? c.sourceA.sourceName : c.sourceB.sourceName}). Confirm that you are following the current academic year terms.`,
      originType: "cycle_difference",
      sourceReference: `${c.sourceA.sourceName} vs ${c.sourceB.sourceName}`,
      completed: false,
    });
  }

  // 5. Medium Priority: Outdated / Undated source warnings
  for (const warn of outdatedWarnings) {
    if (warn.status === "outdated") {
      items.push({
        id: `chk_warn_${warn.id}`,
        priority: "Medium",
        title: `Outdated notice on ${warn.sourceName}`,
        action: `${warn.summary} Verify that none of its superseded dates or requirements are being relied upon.`,
        originType: "outdated",
        sourceReference: warn.sourceName,
        completed: false,
      });
    } else if (warn.status === "undated") {
      items.push({
        id: `chk_undated_${warn.id}`,
        priority: "Medium",
        title: `Verify date of ${warn.sourceName}`,
        action: `Source has no visible publication or cycle date. Confirm when it was last maintained.`,
        originType: "undated",
        sourceReference: warn.sourceName,
        completed: false,
      });
    }
  }

  // 6. Low Priority: Any Other Non-Critical Gaps
  const nonCriticalGaps = gaps.filter((g) => !isCriticalGap(g.topic));
  for (const gap of nonCriticalGaps) {
    items.push({
      id: `chk_gap_noncrit_${gap.id}`,
      priority: "Low",
      title: `Review ${gap.topic}`,
      action: `${gap.topic} (${gap.description}) was not covered by current sources. Verify if needed.`,
      originType: "gap",
      sourceReference: "Optional / Supplementary",
      completed: false,
    });
  }

  return items;
}
