import React from "react";
import { CheckCircle2, AlertTriangle, GitCompare, Clock, HelpCircle } from "lucide-react";
import { AnalysisResult } from "@/lib/types";

interface SummaryCardsProps {
  result: AnalysisResult;
}

export function SummaryCards({ result }: SummaryCardsProps) {
  const verifiedCount = result.facts.filter((f) => f.isVerified).length;
  const gapCount = result.gaps.length;
  const conflictCount = result.conflicts.filter((c) => c.type === "possible_conflict").length;
  const cycleDiffCount = result.conflicts.filter((c) => c.type === "cycle_difference").length;
  const outdatedSourcesCount = result.outdatedWarnings.filter((w) => w.status === "outdated").length;

  const cards = [
    {
      label: "Verified Facts",
      count: verifiedCount,
      icon: CheckCircle2,
      color: "text-[#7D8F69]",
      bg: "bg-[#E6EBDD]/50",
      border: "border-[#7D8F69]/30",
    },
    {
      label: "Potential Gaps",
      count: gapCount,
      icon: HelpCircle,
      color: "text-[#A89B8C]",
      bg: "bg-[#EEE7DC]/50",
      border: "border-[#A89B8C]/30",
    },
    {
      label: "Possible Conflicts",
      count: conflictCount,
      icon: AlertTriangle,
      color: "text-[#B5573A]",
      bg: "bg-[#F3DDD3]/50",
      border: "border-[#B5573A]/30",
    },
    {
      label: "Cycle Differences",
      count: cycleDiffCount,
      icon: GitCompare,
      color: "text-[#C08A2E]",
      bg: "bg-[#F5E8CB]/50",
      border: "border-[#C08A2E]/30",
    },
    {
      label: "Outdated Sources",
      count: outdatedSourcesCount,
      icon: Clock,
      color: "text-[#C08A2E]",
      bg: "bg-[#F5E8CB]/50",
      border: "border-[#C08A2E]/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className={`p-3.5 rounded-lg border bg-[#FBF7F1] ${c.border} flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#7A6352]">{c.label}</span>
              <Icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <div className="text-2xl font-serif font-bold text-[#3B2A20] mt-2">{c.count}</div>
          </div>
        );
      })}
    </div>
  );
}
