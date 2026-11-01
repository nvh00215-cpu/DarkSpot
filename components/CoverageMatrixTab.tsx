import React from "react";
import { CoverageMatrix, Source } from "@/lib/types";
import { CheckCircle2, HelpCircle, AlertCircle, XCircle } from "lucide-react";
import { AiBadge } from "./AiBadge";

interface CoverageMatrixTabProps {
  coverageMatrix: CoverageMatrix;
  sources: Source[];
  onSelectTopic?: (topic: string, quotes: Record<string, string | undefined>) => void;
}

export function CoverageMatrixTab({
  coverageMatrix,
  sources,
  onSelectTopic,
}: CoverageMatrixTabProps) {
  const getStatusBadge = (status: "covered" | "covered_only_by_outdated" | "potential_gap") => {
    switch (status) {
      case "covered":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E6EBDD] text-[#7D8F69] border border-[#7D8F69]/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Covered
          </span>
        );
      case "covered_only_by_outdated":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F5E8CB] text-[#C08A2E] border border-[#C08A2E]/30">
            <AlertCircle className="w-3.5 h-3.5" />
            Covered Only by Outdated
          </span>
        );
      case "potential_gap":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EEE7DC] text-[#A89B8C] border border-[#A89B8C]/40">
            <HelpCircle className="w-3.5 h-3.5" />
            Potential Gap
          </span>
        );
    }
  };

  const getSourceScoreIcon = (score: "covered" | "unclear" | "not_found") => {
    switch (score) {
      case "covered":
        return (
          <span className="inline-flex items-center gap-1 text-[#7D8F69] text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Covered</span>
          </span>
        );
      case "unclear":
        return (
          <span className="inline-flex items-center gap-1 text-[#C08A2E] text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Unclear</span>
          </span>
        );
      case "not_found":
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[#A89B8C] text-xs">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>Not found</span>
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="p-3.5 bg-[#FBF7F1] border border-[#E3D6C6] rounded-xl text-xs text-[#7A6352] flex items-center justify-between">
        <div>
          Showing <span className="font-bold text-[#3B2A20]">{coverageMatrix.topics.length}</span> audit topics.
          Click any row to inspect quotes extracted from each source.
        </div>
        <AiBadge label="Audited Topic Coverage" />
      </div>

      <div className="bg-[#FBF7F1] border border-[#E3D6C6] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#EEE7DC] text-[#3B2A20] border-b border-[#E3D6C6]">
                <th className="p-3.5 font-serif font-bold text-sm min-w-[200px]">Audit Topic</th>
                <th className="p-3.5 font-bold uppercase tracking-wider text-[11px] min-w-[170px]">
                  Overall Status
                </th>
                {sources.map((src) => (
                  <th
                    key={src.id}
                    className="p-3.5 font-semibold text-[#7A6352] max-w-[160px] truncate"
                    title={src.name}
                  >
                    {src.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3D6C6]/60">
              {coverageMatrix.topics.map((t, idx) => (
                <tr
                  key={idx}
                  onClick={() => onSelectTopic?.(t.topic, t.quotes || {})}
                  className="hover:bg-[#F8F3EC] transition-colors cursor-pointer"
                >
                  <td className="p-3.5">
                    <div className="font-semibold text-[#3B2A20] text-sm">{t.topic}</div>
                    {t.topicDescription && (
                      <div className="text-[11px] text-[#7A6352] mt-0.5 leading-snug">
                        {t.topicDescription}
                      </div>
                    )}
                    {t.note && (
                      <div className="text-[10px] text-[#B5573A] mt-1 font-medium italic">
                        Note: {t.note}
                      </div>
                    )}
                  </td>
                  <td className="p-3.5 align-top">{getStatusBadge(t.status)}</td>
                  {sources.map((src) => {
                    const score = t.sourceScores[src.id] || "not_found";
                    return (
                      <td key={src.id} className="p-3.5 align-top">
                        {getSourceScoreIcon(score)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
