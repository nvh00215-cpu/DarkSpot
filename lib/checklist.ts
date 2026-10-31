import { ChecklistItem, Conflict, Gap, OutdatedWarning, Source } from "./types";

interface ChecklistParams {
  conflicts: Conflict[];
  gaps: Gap[];
  outdatedWarnings: OutdatedWarning[];
  sources: Source[];
}

/**
 * Generates a prioritized action checklist:
 * 1. ALWAYS includes: "Confirm the current deadline, official document list, and official application link from the official source" as HIGH priority baseline item.
 * 2. Possible conflicts between current sources = HIGH priority.
 * 3. Missing deadline or missing required documents gaps = HIGH priority.
 * 4. Cycle differences (between current and outdated sources) = MEDIUM priority.
 * 5. Outdated / undated source warnings = MEDIUM priority.
 * 6. An item for EVERY potential gap (missing from all sources or covered only by outdated source) = LOW or MEDIUM based on urgency.
 */
export function generateChecklist({
  conflicts,
  gaps,
  outdatedWarnings,
  sources,
}: ChecklistParams): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  // 1. Mandatory Baseline Item (Always High Priority)
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

  // 3. Medium Priority: Cycle Differences (outdated source vs current source)
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

  // 4. Outdated / Undated warnings
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

  // 5. Item for EVERY potential gap
  for (const gap of gaps) {
    const topicLower = gap.topic.toLowerCase();
    const isUrgent =
      topicLower.includes("deadline") ||
      topicLower.includes("document") ||
      topicLower.includes("eligibility");

    const priority = isUrgent ? "High" : "Low";

    let actionText = "";
    if (gap.gapType === "only_found_in_outdated_source") {
      actionText = `${gap.topic} is only mentioned in an outdated/archived source. Check the official current notice to see if renewal or requirements still apply.`;
    } else {
      actionText = `${gap.topic} was not found in any reviewed sources. Inquire with the scholarship administrator before submitting.`;
    }

    items.push({
      id: `chk_gap_${gap.id}`,
      priority,
      title: `Clarify ${gap.topic}`,
      action: actionText,
      originType: "gap",
      sourceReference: gap.gapType === "only_found_in_outdated_source" ? "Outdated Source Only" : "Missing from all sources",
      completed: false,
    });
  }

  return items;
}
