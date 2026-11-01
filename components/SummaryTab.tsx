import React, { useState } from "react";
import { Fact, Source, FactCategory } from "@/lib/types";
import { CheckCircle2, AlertCircle, Quote } from "lucide-react";

interface SummaryTabProps {
  facts: Fact[];
  sources: Source[];
  onSelectFact?: (fact: Fact) => void;
}

export function SummaryTab({ facts, sources, onSelectFact }: SummaryTabProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const sourceNameMap = new Map(sources.map((s) => [s.id, s.name]));

  const categories: Array<{ id: string; label: string }> = [
    { id: "all", label: "All Categories" },
    { id: "deadline", label: "Deadlines" },
    { id: "eligibility", label: "Eligibility" },
    { id: "required_documents", label: "Required Documents" },
    { id: "application_process", label: "Application Process" },
    { id: "renewal_conditions", label: "Renewal Conditions" },
    { id: "fees_or_amount", label: "Award / Fees" },
    { id: "contact", label: "Contact" },
    { id: "other", label: "Other" },
  ];

  const filteredFacts =
    selectedCategory === "all"
      ? facts
      : facts.filter((f) => f.category === selectedCategory);

  return (
    <div className="flex flex-col gap-4">
      {/* Category filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedCategory(c.id)}
            className={`px-3 py-1.5 rounded-full border transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === c.id
                ? "bg-[#6F4E37] text-[#F6EFE6] border-[#6F4E37] font-semibold"
                : "bg-[#FBF7F1] text-[#7A6352] border-[#E3D6C6] hover:border-[#6F4E37]/50"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {filteredFacts.length === 0 ? (
        <div className="p-8 text-center bg-[#FBF7F1] border border-[#E3D6C6] rounded-xl text-[#7A6352]">
          No facts found in this category.
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredFacts.map((fact) => {
            const sourceName = sourceNameMap.get(fact.sourceId) || fact.sourceId;
            return (
              <div
                key={fact.id}
                onClick={() => onSelectFact?.(fact)}
                className="bg-[#FBF7F1] border border-[#E3D6C6] hover:border-[#6F4E37]/40 rounded-xl p-4 flex flex-col gap-2.5 transition-colors cursor-pointer shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6352] bg-[#EEE7DC] px-2 py-0.5 rounded">
                      {fact.category.replace(/_/g, " ")}
                    </span>
                    <h4 className="text-sm font-semibold text-[#3B2A20] mt-1.5">{fact.value}</h4>
                  </div>
                  {fact.isVerified ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#7D8F69] bg-[#E6EBDD] px-2 py-0.5 rounded-full font-medium shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Verified Quote
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#B5573A] bg-[#F3DDD3] px-2 py-0.5 rounded-full font-medium shrink-0">
                      <AlertCircle className="w-3.5 h-3.5" /> Unverified
                    </span>
                  )}
                </div>

                {/* Verbatim Quote */}
                <div className="quote-block border-l-[#7D8F69] p-3 text-xs flex flex-col gap-1">
                  <p className="italic text-[#3B2A20] leading-relaxed">&ldquo;{fact.exact_quote}&rdquo;</p>
                  <div className="flex items-center justify-between text-[10px] uppercase font-bold text-[#7A6352] mt-1">
                    <span>{sourceName}</span>
                    {fact.date_mentioned && (
                      <span className="font-mono text-[10px] normal-case bg-white/80 px-1.5 py-0.5 rounded border border-[#E3D6C6]">
                        Mentioned: {fact.date_mentioned}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
