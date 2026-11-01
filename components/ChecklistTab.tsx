"use client";

import React, { useState } from "react";
import { ChecklistItem } from "@/lib/types";
import { CheckSquare, Square, AlertCircle, ArrowUpRight } from "lucide-react";

interface ChecklistTabProps {
  items: ChecklistItem[];
  onSelectItem?: (item: ChecklistItem) => void;
}

export function ChecklistTab({ items: initialItems, onSelectItem }: ChecklistTabProps) {
  const [items, setItems] = useState<ChecklistItem[]>(initialItems);

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  const highPriority = items.filter((i) => i.priority === "High");
  const mediumPriority = items.filter((i) => i.priority === "Medium");
  const lowPriority = items.filter((i) => i.priority === "Low");

  const renderSection = (title: string, list: ChecklistItem[], badgeBg: string, badgeText: string) => {
    if (list.length === 0) return null;

    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${badgeBg} ${badgeText}`}>
            {title} ({list.length})
          </span>
        </div>

        <div className="grid gap-2">
          {list.map((item) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border bg-[#FBF7F1] transition-all flex items-start gap-3 ${
                item.completed
                  ? "border-[#E3D6C6]/50 opacity-60 line-through"
                  : "border-[#E3D6C6] hover:border-[#6F4E37]/50 shadow-xs"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleItem(item.id)}
                className="text-[#6F4E37] mt-0.5 cursor-pointer shrink-0"
              >
                {item.completed ? (
                  <CheckSquare className="w-4 h-4 text-[#7D8F69]" />
                ) : (
                  <Square className="w-4 h-4 text-[#7A6352]" />
                )}
              </button>

              <div
                className="flex-1 cursor-pointer"
                onClick={() => onSelectItem?.(item)}
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-[#3B2A20]">{item.title}</h4>
                  {item.sourceReference && (
                    <span className="text-[10px] text-[#7A6352] bg-[#EEE7DC] px-2 py-0.5 rounded font-mono truncate max-w-[200px]">
                      {item.sourceReference}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#7A6352] mt-1 leading-relaxed">{item.action}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="p-3.5 bg-[#F5EDE3] border border-[#A9743F]/30 rounded-xl flex items-center gap-2 text-xs text-[#7A6352]">
        <AlertCircle className="w-4 h-4 text-[#A9743F] shrink-0" />
        <span>
          Action items are prioritized by risk: active contradictions and missing official criteria are High priority.
        </span>
      </div>

      {renderSection("High Priority", highPriority, "bg-[#F3DDD3]", "text-[#B5573A]")}
      {renderSection("Medium Priority", mediumPriority, "bg-[#F5E8CB]", "text-[#C08A2E]")}
      {renderSection("Low Priority", lowPriority, "bg-[#EEE7DC]", "text-[#7A6352]")}
    </div>
  );
}
