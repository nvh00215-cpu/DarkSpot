"use client";

import React, { useState } from "react";
import { LeftPanel } from "@/components/LeftPanel";
import { SummaryCards } from "@/components/SummaryCards";
import { ConflictsTab } from "@/components/ConflictsTab";
import { ChecklistTab } from "@/components/ChecklistTab";
import { CoverageMatrixTab } from "@/components/CoverageMatrixTab";
import { OutdatedWarningsTab } from "@/components/OutdatedWarningsTab";
import { SummaryTab } from "@/components/SummaryTab";
import { RightSidePanel, SidePanelDetail } from "@/components/RightSidePanel";
import {
  AnalysisResult,
  SourceInput,
  Conflict,
  ChecklistItem,
  Fact,
  OutdatedWarning,
} from "@/lib/types";
import { AlertCircle, FileText, CheckCircle2, AlertTriangle, ShieldCheck, HelpCircle } from "lucide-react";

export default function Home() {
  const [question, setQuestion] = useState("What should I verify before applying for this scholarship?");
  const [sources, setSources] = useState<SourceInput[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("Preparing request");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorBanner, setErrorBanner] = useState<{ code: string; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "coverage" | "conflicts" | "outdated" | "checklist">("conflicts");
  const [sidePanelDetail, setSidePanelDetail] = useState<SidePanelDetail | null>(null);

  const runAnalysis = async () => {
    setIsLoading(true);
    setErrorBanner(null);

    const stages = [
      "Fetching and ingesting sources",
      "Extracting facts with verbatim quotes",
      "Auditing topic coverage & gaps",
      "Detecting contradictions & cycle differences",
      "Building prioritized verify checklist",
    ];

    let stageIdx = 0;
    setLoadingStage(stages[0]);
    const interval = setInterval(() => {
      stageIdx = (stageIdx + 1) % stages.length;
      setLoadingStage(stages[stageIdx]);
    }, 4500);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, sources }),
      });

      clearInterval(interval);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw {
          code: errorData.code || "REQUEST_FAILED",
          message: errorData.message || `Server returned HTTP ${response.status}`,
        };
      }

      const data: AnalysisResult = await response.json();
      setResult(data);
    } catch (err: any) {
      clearInterval(interval);
      console.error("Analysis request failed:", err);
      setErrorBanner({
        code: err.code || "ERROR",
        message: err.message || "An unexpected error occurred during analysis.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSavedResult = async () => {
    try {
      const res = await fetch("/api/sample-analysis");
      if (!res.ok) throw new Error("Could not load sample analysis file.");
      const data: AnalysisResult = await res.json();
      data.isEmergencyFallback = true;
      setResult(data);
      setErrorBanner(null);
    } catch (err: any) {
      alert("Error loading pre-saved analysis: " + err.message);
    }
  };

  // Inspect Conflict detail
  const handleSelectConflict = (c: Conflict) => {
    setSidePanelDetail({
      title: c.topic,
      category: c.category,
      description: c.explanation,
      quotes: [
        {
          sourceName: c.sourceA.sourceName,
          quoteText: c.sourceA.quote,
          factValue: c.sourceA.factValue,
          isOutdated: c.sourceA.isOutdated,
        },
        {
          sourceName: c.sourceB.sourceName,
          quoteText: c.sourceB.quote,
          factValue: c.sourceB.factValue,
          isOutdated: c.sourceB.isOutdated,
        },
      ],
    });
  };

  // Inspect Fact detail
  const handleSelectFact = (f: Fact) => {
    const source = result?.sources.find((s) => s.id === f.sourceId);
    setSidePanelDetail({
      title: f.value,
      category: f.category,
      description: f.verificationNote || (f.isVerified ? "Verified verbatim quote from source document." : "Quote could not be found verbatim in source text."),
      quotes: [
        {
          sourceName: source?.name || f.sourceId,
          sourceUrl: source?.url,
          quoteText: f.exact_quote,
          factValue: f.value,
        },
      ],
    });
  };

  // Inspect Coverage Topic detail
  const handleSelectTopic = (topic: string, quotes: Record<string, string | undefined>) => {
    const matchingQuotes = Object.entries(quotes)
      .filter(([_, q]) => q && q.trim().length > 0)
      .map(([sId, q]) => {
        const source = result?.sources.find((s) => s.id === sId);
        return {
          sourceName: source?.name || sId,
          sourceUrl: source?.url,
          quoteText: q || "",
        };
      });

    setSidePanelDetail({
      title: topic,
      category: "Coverage Audit",
      description: `Quotes extracted from each source evaluating coverage for: ${topic}`,
      quotes: matchingQuotes,
    });
  };

  // Inspect Outdated warning detail
  const handleSelectWarning = (w: OutdatedWarning) => {
    setSidePanelDetail({
      title: w.sourceName,
      category: "Freshness & Cycle Check",
      description: w.summary,
      quotes: w.evidenceList.map((e) => ({
        sourceName: w.sourceName,
        quoteText: e.quote || "No direct text excerpt recorded",
        note: `${e.message} (${e.detectedDate || "N/A"})`,
      })),
    });
  };

  // Inspect Checklist item detail
  const handleSelectChecklistItem = (item: ChecklistItem) => {
    setSidePanelDetail({
      title: item.title,
      category: `${item.priority} Priority Action`,
      description: item.action,
      quotes: item.sourceReference
        ? [
            {
              sourceName: item.sourceReference,
              quoteText: item.action,
              note: `Checklist Origin: ${item.originType}`,
            },
          ]
        : [],
    });
  };

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Right Side Panel for Quote Inspection */}
      <RightSidePanel detail={sidePanelDetail} onClose={() => setSidePanelDetail(null)} />

      {/* Emergency / Error Banner */}
      {errorBanner && (
        <div className="bg-[#F3DDD3] border border-[#B5573A] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 text-[#B5573A]">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <span className="font-bold uppercase tracking-wider text-xs mr-2">[{errorBanner.code}]</span>
              <span>{errorBanner.message}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLoadSavedResult}
            className="px-3 py-1.5 bg-[#6F4E37] text-[#F6EFE6] text-xs font-medium rounded-lg hover:bg-[#5A3E2B] shrink-0 cursor-pointer"
          >
            View Pre-Saved Sample Result
          </button>
        </div>
      )}

      {/* Pre-saved Notice if emergency fallback is viewed */}
      {result?.isEmergencyFallback && (
        <div className="bg-[#F5E8CB] border border-[#C08A2E] rounded-xl p-3 text-xs text-[#7A6352] flex items-center justify-between">
          <span>⚠️ Displaying saved result from an earlier run, not live.</span>
        </div>
      )}

      {/* Main Grid: Left Control Panel + Right Results Dashboard */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left Input Panel (4 columns) */}
        <div className="lg:col-span-4 sticky top-6">
          <LeftPanel
            question={question}
            setQuestion={setQuestion}
            sources={sources}
            setSources={setSources}
            onAnalyze={runAnalysis}
            isLoading={isLoading}
            loadingStage={loadingStage}
          />
        </div>

        {/* Right Dashboard Area (8 columns) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {!result && !isLoading && (
            <div className="bg-[#FBF7F1] border border-[#E3D6C6] rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3 text-[#7A6352]">
              <div className="w-12 h-12 rounded-full bg-[#EEE7DC] flex items-center justify-center text-[#6F4E37]">
                <FileText className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-serif font-bold text-[#3B2A20]">No Analysis Run Yet</h2>
              <p className="text-xs text-[#7A6352] max-w-md leading-relaxed">
                Add URLs or paste text from multiple scholarship sources, then click &ldquo;Run Gap Analysis&rdquo; to detect missing criteria, cycle changes, and contradictions.
              </p>
              <button
                type="button"
                onClick={handleLoadSavedResult}
                className="mt-2 text-xs text-[#6F4E37] hover:underline font-medium cursor-pointer"
              >
                Or preview a pre-generated analysis result
              </button>
            </div>
          )}

          {result && (
            <>
              {/* Summary Cards */}
              <SummaryCards result={result} />

              {/* Navigation Tabs */}
              <div className="bg-[#FBF7F1] border border-[#E3D6C6] rounded-xl p-1.5 flex gap-1 text-xs font-medium text-[#7A6352] overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab("conflicts")}
                  className={`px-3 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap ${
                    activeTab === "conflicts"
                      ? "bg-[#6F4E37] text-[#F6EFE6] font-semibold"
                      : "hover:bg-[#EEE7DC]"
                  }`}
                >
                  Conflicts ({result.conflicts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("coverage")}
                  className={`px-3 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap ${
                    activeTab === "coverage"
                      ? "bg-[#6F4E37] text-[#F6EFE6] font-semibold"
                      : "hover:bg-[#EEE7DC]"
                  }`}
                >
                  Coverage Matrix ({result.coverageMatrix.topics.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("outdated")}
                  className={`px-3 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap ${
                    activeTab === "outdated"
                      ? "bg-[#6F4E37] text-[#F6EFE6] font-semibold"
                      : "hover:bg-[#EEE7DC]"
                  }`}
                >
                  Outdated Warnings ({result.outdatedWarnings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("summary")}
                  className={`px-3 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap ${
                    activeTab === "summary"
                      ? "bg-[#6F4E37] text-[#F6EFE6] font-semibold"
                      : "hover:bg-[#EEE7DC]"
                  }`}
                >
                  Sourced Facts ({result.facts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("checklist")}
                  className={`px-3 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap ${
                    activeTab === "checklist"
                      ? "bg-[#6F4E37] text-[#F6EFE6] font-semibold"
                      : "hover:bg-[#EEE7DC]"
                  }`}
                >
                  Verify Checklist ({result.checklist.length})
                </button>
              </div>

              {/* Tab Contents */}
              <div>
                {activeTab === "conflicts" && (
                  <ConflictsTab conflicts={result.conflicts} onSelectConflict={handleSelectConflict} />
                )}
                {activeTab === "coverage" && (
                  <CoverageMatrixTab
                    coverageMatrix={result.coverageMatrix}
                    sources={result.sources}
                    onSelectTopic={handleSelectTopic}
                  />
                )}
                {activeTab === "outdated" && (
                  <OutdatedWarningsTab
                    warnings={result.outdatedWarnings}
                    onSelectWarning={handleSelectWarning}
                  />
                )}
                {activeTab === "summary" && (
                  <SummaryTab
                    facts={result.facts}
                    sources={result.sources}
                    onSelectFact={handleSelectFact}
                  />
                )}
                {activeTab === "checklist" && (
                  <ChecklistTab items={result.checklist} onSelectItem={handleSelectChecklistItem} />
                )}
              </div>

              {/* Telemetry Footer */}
              <div className="text-xs text-[#A89B8C] border-t border-[#E3D6C6] pt-4 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div>
                  Analyzed with:{" "}
                  <span className="font-semibold text-[#7A6352]">
                    {result.modelsUsed.map((m) => `${m.provider} (${m.model})`).filter((v, i, a) => a.indexOf(v) === i).join(", ")}
                  </span>
                </div>
                <div className="text-[11px] italic">AI-generated signals, verify with official sources.</div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
