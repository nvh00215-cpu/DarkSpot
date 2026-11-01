import React from "react";
import { OutdatedWarning } from "@/lib/types";
import { Clock, AlertCircle, CheckCircle } from "lucide-react";

interface OutdatedWarningsTabProps {
  warnings: OutdatedWarning[];
  onSelectWarning?: (warning: OutdatedWarning) => void;
}

export function OutdatedWarningsTab({ warnings, onSelectWarning }: OutdatedWarningsTabProps) {
  if (warnings.length === 0) {
    return (
      <div className="p-8 text-center bg-[#FBF7F1] border border-[#E3D6C6] rounded-xl text-[#7A6352]">
        <p className="font-serif text-lg mb-1">All Sources Current</p>
        <p className="text-xs text-[#A89B8C]">No outdated or undated sources found.</p>
      </div>
    );
  }

  const getStatusBadge = (status: "outdated" | "undated" | "current") => {
    switch (status) {
      case "outdated":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F5E8CB] text-[#C08A2E] border border-[#C08A2E]/40">
            <Clock className="w-3.5 h-3.5" />
            Outdated Source
          </span>
        );
      case "undated":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EEE7DC] text-[#7A6352] border border-[#E3D6C6]">
            <AlertCircle className="w-3.5 h-3.5" />
            Undated Source
          </span>
        );
      case "current":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E6EBDD] text-[#7D8F69] border border-[#7D8F69]/30">
            <CheckCircle className="w-3.5 h-3.5" />
            Active & Current
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="p-3.5 bg-[#FBF7F1] border border-[#E3D6C6] rounded-xl text-xs text-[#7A6352]">
        Sources referencing cycles older than 12 months or missing publication dates are flagged below with their supporting evidence quotes.
      </div>

      <div className="grid gap-4">
        {warnings.map((w) => (
          <div
            key={w.id}
            onClick={() => onSelectWarning?.(w)}
            className={`bg-[#FBF7F1] border rounded-xl p-4 flex flex-col gap-3 transition-colors cursor-pointer shadow-xs ${
              w.status === "outdated"
                ? "border-[#C08A2E]/40 hover:border-[#C08A2E]"
                : w.status === "undated"
                ? "border-[#E3D6C6] hover:border-[#7A6352]"
                : "border-[#7D8F69]/30"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-base font-serif font-bold text-[#3B2A20]">{w.sourceName}</h4>
                <p className="text-xs text-[#7A6352] mt-0.5">{w.summary}</p>
              </div>
              {getStatusBadge(w.status)}
            </div>

            {w.evidenceList.length > 0 && (
              <div className="flex flex-col gap-2 mt-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#7A6352]">
                  Evidence Quotes ({w.evidenceList.length})
                </span>
                <div className="grid gap-2">
                  {w.evidenceList.map((e, idx) => (
                    <div key={idx} className="quote-block border-l-[#C08A2E] p-3 text-xs flex flex-col gap-1">
                      {e.quote && <p className="italic text-[#3B2A20]">&ldquo;{e.quote}&rdquo;</p>}
                      <div className="flex items-center justify-between text-[11px] text-[#7A6352] mt-1">
                        <span>{e.message}</span>
                        {e.detectedDate && (
                          <span className="font-mono bg-[#EEE7DC] px-1.5 py-0.5 rounded text-[10px]">
                            {e.detectedDate}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
