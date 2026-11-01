"use client";

import React from "react";
import { X, Quote, ExternalLink, FileText, CheckCircle2 } from "lucide-react";

export interface SidePanelDetail {
  title: string;
  category?: string;
  statusBadge?: React.ReactNode;
  description?: string;
  quotes: Array<{
    sourceName: string;
    sourceUrl?: string;
    quoteText: string;
    factValue?: string;
    isOutdated?: boolean;
    note?: string;
  }>;
}

interface RightSidePanelProps {
  detail: SidePanelDetail | null;
  onClose: () => void;
}

export function RightSidePanel({ detail, onClose }: RightSidePanelProps) {
  if (!detail) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-[#FBF7F1] border-l border-[#E3D6C6] shadow-xl z-50 p-6 flex flex-col gap-6 overflow-y-auto animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-[#E3D6C6] pb-4">
        <div>
          {detail.category && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6352] bg-[#EEE7DC] px-2 py-0.5 rounded">
              {detail.category.replace(/_/g, " ")}
            </span>
          )}
          <h3 className="text-lg font-serif font-bold text-[#3B2A20] mt-1.5">{detail.title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[#7A6352] hover:text-[#3B2A20] p-1.5 rounded-lg hover:bg-[#EEE7DC] cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {detail.description && (
        <p className="text-xs text-[#7A6352] leading-relaxed bg-[#F8F3EC] p-3 rounded-lg border border-[#E3D6C6]/60">
          {detail.description}
        </p>
      )}

      {/* Supporting Quotes List */}
      <div className="flex flex-col gap-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7A6352]">
          Supporting Source Quotes ({detail.quotes.length})
        </h4>

        {detail.quotes.length === 0 ? (
          <div className="text-xs text-[#A89B8C] italic p-4 text-center border border-dashed border-[#E3D6C6] rounded-lg">
            No verbatim quotes found for this item across the reviewed sources.
          </div>
        ) : (
          detail.quotes.map((q, idx) => (
            <div key={idx} className="bg-white border border-[#E3D6C6] rounded-xl p-4 flex flex-col gap-2.5 shadow-xs">
              <div className="flex items-center justify-between text-xs">
                <span className="font-serif font-bold text-[#3B2A20] truncate">
                  {q.sourceName} {q.isOutdated && <span className="text-[#C08A2E] text-[10px] font-sans font-normal">(Outdated)</span>}
                </span>
                {q.sourceUrl && (
                  <a
                    href={q.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#6F4E37] hover:underline inline-flex items-center gap-1 text-[11px]"
                  >
                    Visit <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {q.factValue && (
                <div className="text-xs font-medium text-[#7A6352]">
                  Claim: &ldquo;{q.factValue}&rdquo;
                </div>
              )}

              {/* Exact Verbatim Quote */}
              <div className="quote-block border-l-[#6F4E37] p-3 text-xs leading-relaxed text-[#3B2A20] italic">
                &ldquo;{q.quoteText || "No text quotation available"}&rdquo;
              </div>

              {q.note && (
                <div className="text-[11px] text-[#A89B8C] italic">{q.note}</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
