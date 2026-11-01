import React from "react";
import { Conflict } from "@/lib/types";
import { AiBadge } from "./AiBadge";
import { AlertTriangle, GitCompare } from "lucide-react";

interface ConflictsTabProps {
  conflicts: Conflict[];
  onSelectConflict?: (conflict: Conflict) => void;
}

export function ConflictsTab({ conflicts, onSelectConflict }: ConflictsTabProps) {
  if (conflicts.length === 0) {
    return (
      <div className="p-8 text-center bg-[#FBF7F1] border border-[#E3D6C6] rounded-xl text-[#7A6352]">
        <p className="font-serif text-lg mb-1">No Discrepancies Detected</p>
        <p className="text-xs text-[#A89B8C]">
          The reviewed sources do not contain contradictory statements within evaluated categories.
        </p>
      </div>
    );
  }

  const directConflicts = conflicts.filter((c) => c.type === "possible_conflict");
  const cycleDiffs = conflicts.filter((c) => c.type === "cycle_difference");

  return (
    <div className="flex flex-col gap-6">
      {/* Direct Possible Conflicts */}
      {directConflicts.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#B5573A]" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#B5573A]">
              Possible Conflicts (Disagreements Between Current Sources)
            </h3>
          </div>

          <div className="grid gap-3">
            {directConflicts.map((c) => (
              <div
                key={c.id}
                onClick={() => onSelectConflict?.(c)}
                className="bg-[#FBF7F1] border border-[#B5573A]/30 rounded-xl p-4 flex flex-col gap-3 hover:border-[#B5573A] transition-colors cursor-pointer shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#7A6352]">
                      {c.category.replace(/_/g, " ")}
                    </span>
                    <h4 className="text-base font-serif font-bold text-[#3B2A20] mt-0.5">{c.topic}</h4>
                  </div>
                  <AiBadge confidence={c.confidence} label="Possible Conflict" />
                </div>

                <p className="text-xs text-[#7A6352]">{c.explanation}</p>

                {/* Side-by-side quotes */}
                <div className="grid md:grid-cols-2 gap-3 mt-1">
                  {/* Source A */}
                  <div className="quote-block border-l-[#B5573A] p-3 text-xs flex flex-col justify-between">
                    <p className="italic text-[#3B2A20] leading-relaxed">&ldquo;{c.sourceA.quote}&rdquo;</p>
                    <div className="mt-2 text-[10px] uppercase font-bold text-[#7A6352]">
                      {c.sourceA.sourceName}
                    </div>
                  </div>

                  {/* Source B */}
                  <div className="quote-block border-l-[#B5573A] p-3 text-xs flex flex-col justify-between">
                    <p className="italic text-[#3B2A20] leading-relaxed">&ldquo;{c.sourceB.quote}&rdquo;</p>
                    <div className="mt-2 text-[10px] uppercase font-bold text-[#7A6352]">
                      {c.sourceB.sourceName}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cycle Differences */}
      {cycleDiffs.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-[#C08A2E]" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#C08A2E]">
              Cycle Differences (Disagreements Involving Outdated/Past Sources)
            </h3>
          </div>

          <div className="grid gap-3">
            {cycleDiffs.map((c) => (
              <div
                key={c.id}
                onClick={() => onSelectConflict?.(c)}
                className="bg-[#FBF7F1] border border-[#C08A2E]/30 rounded-xl p-4 flex flex-col gap-3 hover:border-[#C08A2E] transition-colors cursor-pointer shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#7A6352]">
                      {c.category.replace(/_/g, " ")}
                    </span>
                    <h4 className="text-base font-serif font-bold text-[#3B2A20] mt-0.5">{c.topic}</h4>
                  </div>
                  <AiBadge confidence="medium" label="Cycle Difference" />
                </div>

                <p className="text-xs text-[#7A6352]">{c.explanation}</p>

                {/* Side-by-side quotes */}
                <div className="grid md:grid-cols-2 gap-3 mt-1">
                  <div className="quote-block border-l-[#C08A2E] p-3 text-xs flex flex-col justify-between">
                    <p className="italic text-[#3B2A20] leading-relaxed">&ldquo;{c.sourceA.quote}&rdquo;</p>
                    <div className="mt-2 text-[10px] uppercase font-bold text-[#7A6352]">
                      {c.sourceA.sourceName} {c.sourceA.isOutdated ? "(Outdated)" : "(Current)"}
                    </div>
                  </div>

                  <div className="quote-block border-l-[#C08A2E] p-3 text-xs flex flex-col justify-between">
                    <p className="italic text-[#3B2A20] leading-relaxed">&ldquo;{c.sourceB.quote}&rdquo;</p>
                    <div className="mt-2 text-[10px] uppercase font-bold text-[#7A6352]">
                      {c.sourceB.sourceName} {c.sourceB.isOutdated ? "(Outdated)" : "(Current)"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
