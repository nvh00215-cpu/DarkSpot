"use client";

import React, { useState } from "react";
import { Plus, Globe, FileText, Trash2, BookOpen, AlertCircle, RefreshCw } from "lucide-react";
import { SourceInput } from "@/lib/types";

interface LeftPanelProps {
  question: string;
  setQuestion: (q: string) => void;
  sources: SourceInput[];
  setSources: React.Dispatch<React.SetStateAction<SourceInput[]>>;
  onAnalyze: () => void;
  isLoading: boolean;
  loadingStage: string;
}

export function LeftPanel({
  question,
  setQuestion,
  sources,
  setSources,
  onAnalyze,
  isLoading,
  loadingStage,
}: LeftPanelProps) {
  const [activeTab, setActiveTab] = useState<"url" | "text">("url");
  const [urlInput, setUrlInput] = useState("");
  const [urlName, setUrlName] = useState("");
  const [textInput, setTextInput] = useState("");
  const [textName, setTextInputName] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!urlInput.trim()) return;

    try {
      const parsed = new URL(urlInput.trim());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setErrorMsg("Only http/https URLs are permitted.");
        return;
      }
    } catch {
      setErrorMsg("Please enter a valid URL (e.g. https://example.org).");
      return;
    }

    if (sources.length >= 5) {
      setErrorMsg("Maximum of 5 sources allowed per analysis.");
      return;
    }

    setSources((prev) => [
      ...prev,
      {
        type: "url",
        url: urlInput.trim(),
        name: urlName.trim() || undefined,
      },
    ]);
    setUrlInput("");
    setUrlName("");
  };

  const handleAddText = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!textInput.trim()) return;

    if (sources.length >= 5) {
      setErrorMsg("Maximum of 5 sources allowed per analysis.");
      return;
    }

    if (textInput.length > 15000) {
      setErrorMsg("Pasted text exceeds the 15,000 character limit.");
      return;
    }

    setSources((prev) => [
      ...prev,
      {
        type: "text",
        text: textInput.trim(),
        name: textName.trim() || `Pasted Document ${prev.length + 1}`,
      },
    ]);
    setTextInput("");
    setTextInputName("");
  };

  const handleRemoveSource = (index: number) => {
    setSources((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLoadSample = async () => {
    setErrorMsg(null);
    try {
      const res = await fetch("/api/sample-data");
      if (!res.ok) throw new Error("Could not load sample data.");
      const data = await res.json();
      setQuestion(data.question);
      setSources(data.sources);
    } catch (err: any) {
      setErrorMsg("Failed to load sample dataset: " + err.message);
    }
  };

  return (
    <div className="bg-[#FBF7F1] border border-[#E3D6C6] rounded-xl p-5 flex flex-col gap-6 shadow-[0_1px_3px_rgba(59,42,32,0.04)]">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-5 h-5 text-[#6F4E37]" />
          <h1 className="text-2xl font-serif font-bold text-[#3B2A20] tracking-tight">GapSense</h1>
        </div>
        <p className="text-xs text-[#7A6352] font-sans">Find what your sources don&apos;t tell you.</p>
      </div>

      {/* Research Question */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#7A6352]">
          Research Question
        </label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What should I verify before applying for this scholarship?"
          rows={3}
          maxLength={500}
          className="w-full text-sm bg-white border border-[#E3D6C6] rounded-lg p-3 text-[#3B2A20] placeholder-[#A89B8C] focus:outline-none focus:border-[#6F4E37] focus:ring-1 focus:ring-[#6F4E37] transition-all resize-none"
        />
        <div className="text-[11px] text-[#A89B8C] text-right">{question.length}/500</div>
      </div>

      {/* Source Manager */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#7A6352]">
            Sources ({sources.length}/5)
          </label>
          <button
            type="button"
            onClick={handleLoadSample}
            className="text-xs text-[#6F4E37] hover:underline font-medium cursor-pointer"
          >
            Load sample data
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-[#EEE7DC] p-0.5 rounded-lg text-xs font-medium text-[#7A6352]">
          <button
            type="button"
            onClick={() => setActiveTab("url")}
            className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === "url" ? "bg-white text-[#3B2A20] font-semibold shadow-xs" : "hover:text-[#3B2A20]"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Add URL
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("text")}
            className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === "text" ? "bg-white text-[#3B2A20] font-semibold shadow-xs" : "hover:text-[#3B2A20]"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Paste Text
          </button>
        </div>

        {/* Input Forms */}
        {activeTab === "url" ? (
          <form onSubmit={handleAddUrl} className="flex flex-col gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.org/guidelines"
              className="text-xs bg-white border border-[#E3D6C6] rounded-lg p-2 text-[#3B2A20] placeholder-[#A89B8C] focus:outline-none focus:border-[#6F4E37]"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={urlName}
                onChange={(e) => setUrlName(e.target.value)}
                placeholder="Label (optional)"
                className="flex-1 text-xs bg-white border border-[#E3D6C6] rounded-lg p-2 text-[#3B2A20] placeholder-[#A89B8C] focus:outline-none focus:border-[#6F4E37]"
              />
              <button
                type="submit"
                disabled={!urlInput.trim() || sources.length >= 5}
                className="px-3 py-1.5 bg-[#6F4E37] text-[#F6EFE6] text-xs font-medium rounded-lg hover:bg-[#5A3E2B] disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleAddText} className="flex flex-col gap-2">
            <input
              type="text"
              value={textName}
              onChange={(e) => setTextInputName(e.target.value)}
              placeholder="Source label / title"
              className="text-xs bg-white border border-[#E3D6C6] rounded-lg p-2 text-[#3B2A20] placeholder-[#A89B8C] focus:outline-none focus:border-[#6F4E37]"
            />
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste raw text here (max 15,000 characters)..."
              rows={3}
              maxLength={15000}
              className="text-xs bg-white border border-[#E3D6C6] rounded-lg p-2 text-[#3B2A20] placeholder-[#A89B8C] focus:outline-none focus:border-[#6F4E37] resize-none"
            />
            <button
              type="submit"
              disabled={!textInput.trim() || sources.length >= 5}
              className="self-end px-3 py-1.5 bg-[#6F4E37] text-[#F6EFE6] text-xs font-medium rounded-lg hover:bg-[#5A3E2B] disabled:opacity-40 cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Source
            </button>
          </form>
        )}

        {errorMsg && (
          <div className="flex items-center gap-1.5 text-xs text-[#B5573A] bg-[#F3DDD3] p-2 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Source List */}
        <div className="flex flex-col gap-2 mt-1">
          {sources.length === 0 ? (
            <div className="text-xs text-[#A89B8C] italic text-center py-4 border border-dashed border-[#E3D6C6] rounded-lg">
              No sources added yet.
            </div>
          ) : (
            sources.map((src, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 p-2.5 bg-white border border-[#E3D6C6] rounded-lg text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {src.type === "url" ? (
                    <Globe className="w-3.5 h-3.5 text-[#7A6352] shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-[#7A6352] shrink-0" />
                  )}
                  <span className="truncate font-medium text-[#3B2A20]">
                    {src.name || (src.type === "url" ? src.url : `Pasted text ${idx + 1}`)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveSource(idx)}
                  className="text-[#A89B8C] hover:text-[#B5573A] cursor-pointer p-1"
                  title="Remove source"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Action Button */}
      <div className="flex flex-col gap-2 mt-auto pt-2">
        <button
          type="button"
          onClick={onAnalyze}
          disabled={isLoading || !question.trim() || sources.length === 0}
          className="w-full py-3 bg-[#6F4E37] hover:bg-[#5A3E2B] text-[#F6EFE6] font-medium text-sm rounded-lg transition-all shadow-xs disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-[#F6EFE6]" />
              <span>Analyzing...</span>
            </>
          ) : (
            <span>Run Gap Analysis</span>
          )}
        </button>

        {isLoading && (
          <div className="flex flex-col gap-1.5 text-center mt-1">
            <div className="w-full bg-[#E3D6C6] h-1 rounded-full overflow-hidden">
              <div className="bg-[#6F4E37] h-full animate-pulse w-3/4 rounded-full" />
            </div>
            <p className="text-xs text-[#7A6352] font-medium">{loadingStage}...</p>
            <p className="text-[11px] text-[#A89B8C]">Takes up to 60 seconds with live LLM verification.</p>
          </div>
        )}
      </div>
    </div>
  );
}
