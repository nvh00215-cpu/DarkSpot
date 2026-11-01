import React from "react";
import { Sparkles } from "lucide-react";

interface AiBadgeProps {
  confidence?: "high" | "medium" | "low";
  label?: string;
  className?: string;
}

export function AiBadge({ confidence, label = "AI signal", className = "" }: AiBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border border-[#A9743F]/50 bg-[#F5EDE3] text-[#A9743F] ${className}`}
    >
      <Sparkles className="w-3 h-3 text-[#A9743F]" />
      <span>{label}</span>
      {confidence && (
        <span className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">
          ({confidence})
        </span>
      )}
    </span>
  );
}
