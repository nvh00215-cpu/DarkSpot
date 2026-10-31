import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { ingestAllSources } from "../lib/ingest";
import { extractAllFacts } from "../lib/extract";
import { verifyFactQuotes } from "../lib/verifyQuotes";
import { analyzeCoverage } from "../lib/coverage";
import { detectConflicts } from "../lib/conflicts";
import { checkOutdatedInformation } from "../lib/dates";
import { generateChecklist } from "../lib/checklist";
import { AnalysisResult, SourceInput } from "../lib/types";

async function main() {
  console.log("Generating fresh static sample analysis result via live pipeline...");

  const sampleDir = path.join(process.cwd(), "data", "sample");
  const sourceAText = fs.readFileSync(path.join(sampleDir, "sourceA.txt"), "utf-8");
  const sourceBText = fs.readFileSync(path.join(sampleDir, "sourceB.txt"), "utf-8");
  const sourceCText = fs.readFileSync(path.join(sampleDir, "sourceC.txt"), "utf-8");

  const question = "What should I verify before applying for this scholarship?";

  const sourceInputs: SourceInput[] = [
    {
      type: "text",
      name: "Source A (Official Scholarship Portal)",
      text: sourceAText,
    },
    {
      type: "text",
      name: "Source B (STEM Grant Watch Blog - Oct 2026)",
      text: sourceBText,
    },
    {
      type: "text",
      name: "Source C (Archived Grant Guidelines 2023-2024)",
      text: sourceCText,
    },
  ];

  const sources = await ingestAllSources(sourceInputs);
  const { facts: rawFacts, callRecords: extractRecords } = await extractAllFacts(sources, question);
  const verifiedFacts = verifyFactQuotes(rawFacts, sources);
  const { coverageMatrix, gaps, callRecords: coverageRecords } = await analyzeCoverage(question, sources);
  const { conflicts, callRecords: conflictRecords } = await detectConflicts(verifiedFacts, sources);
  const outdatedWarnings = checkOutdatedInformation(verifiedFacts, sources, new Date("2026-11-01"));
  const checklist = generateChecklist({
    conflicts,
    gaps,
    outdatedWarnings,
    sources,
  });

  const allModelsUsed = [...extractRecords, ...coverageRecords, ...conflictRecords];

  const analysisResult: AnalysisResult = {
    question,
    analyzedAt: new Date().toISOString(),
    sources,
    facts: verifiedFacts,
    coverageMatrix,
    gaps,
    conflicts,
    outdatedWarnings,
    checklist,
    modelsUsed: allModelsUsed,
    isEmergencyFallback: true, // Marked true when loaded as static emergency fallback
  };

  const outPath = path.join(sampleDir, "analysis.json");
  fs.writeFileSync(outPath, JSON.stringify(analysisResult, null, 2), "utf-8");
  console.log(`Successfully generated and saved ${outPath}`);
}

main().catch((err) => {
  console.error("Failed to generate sample analysis:", err);
  process.exit(1);
});
