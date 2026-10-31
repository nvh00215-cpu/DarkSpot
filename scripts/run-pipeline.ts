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
  console.log("==================================================");
  console.log("       GapSense End-to-End Pipeline Runner        ");
  console.log("==================================================");

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

  console.log(`\nQuestion: "${question}"`);
  console.log(`Sources: ${sourceInputs.length} sample documents\n`);

  // Step 1: Ingest
  console.log("Step 1: Ingesting sources...");
  const sources = await ingestAllSources(sourceInputs);
  console.log(`   ✓ Ingested ${sources.length} sources.`);

  // Step 2: Extract Facts
  console.log("\nStep 2: Extracting facts via LLM layer...");
  const { facts: rawFacts, callRecords: extractRecords } = await extractAllFacts(sources, question);
  console.log(`   ✓ Extracted ${rawFacts.length} facts.`);

  // Step 3: Verify Quotes
  console.log("\nStep 3: Verifying exact quotes against source texts (Deterministic)...");
  const verifiedFacts = verifyFactQuotes(rawFacts, sources);
  const unverified = verifiedFacts.filter((f) => !f.isVerified);
  console.log(`   ✓ Verified quotes: ${verifiedFacts.length - unverified.length} passed, ${unverified.length} unverified.`);

  // Step 4: Coverage & Gaps
  console.log("\nStep 4: Running topic coverage analysis & gap detection...");
  const { coverageMatrix, gaps, callRecords: coverageRecords } = await analyzeCoverage(question, sources);
  console.log(`   ✓ Generated ${coverageMatrix.topics.length} topics.`);
  console.log(`   ✓ Identified ${gaps.length} potential gaps.`);

  // Step 5: Conflicts
  console.log("\nStep 5: Detecting conflicts across sources...");
  const { conflicts, callRecords: conflictRecords } = await detectConflicts(verifiedFacts, sources);
  console.log(`   ✓ Identified ${conflicts.length} possible conflicts.`);

  // Step 6: Outdated & Undated Warnings
  console.log("\nStep 6: Checking for outdated / past-cycle warnings (Deterministic)...");
  const outdatedWarnings = checkOutdatedInformation(verifiedFacts, sources, new Date("2026-11-01"));
  console.log(`   ✓ Generated ${outdatedWarnings.length} outdated/undated warnings.`);

  // Step 7: Prioritized Checklist
  console.log("\nStep 7: Generating prioritized action checklist...");
  const checklist = generateChecklist({
    conflicts,
    gaps,
    outdatedWarnings,
    sources,
  });
  console.log(`   ✓ Created ${checklist.length} checklist items.`);

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
    isEmergencyFallback: false,
  };

  // Save to sample analysis.json for emergency fallback
  const outPath = path.join(sampleDir, "analysis.json");
  fs.writeFileSync(outPath, JSON.stringify(analysisResult, null, 2), "utf-8");
  console.log(`\nSaved analysis result to: ${outPath}`);

  // Display required outputs
  console.log("\n==================================================");
  console.log("            PIPELINE EXECUTION REPORT             ");
  console.log("==================================================");

  console.log("\n--- 1. UNVERIFIED FACTS (Failed quote verification) ---");
  if (unverified.length === 0) {
    console.log("All quotes successfully verified verbatim in source texts.");
  } else {
    unverified.forEach((f) => {
      console.log(`[!] Category: ${f.category} | Source: ${f.sourceId}`);
      console.log(`    Value: ${f.value}`);
      console.log(`    Quote: "${f.exact_quote}"`);
      console.log(`    Note: ${f.verificationNote}`);
    });
  }

  console.log("\n--- 2. COVERAGE MATRIX ---");
  coverageMatrix.topics.forEach((t) => {
    const scores = Object.entries(t.sourceScores)
      .map(([sId, sc]) => `${sId}: ${sc}`)
      .join(" | ");
    console.log(`• [${t.isGap ? "POTENTIAL GAP" : "COVERED"}] ${t.topic}`);
    console.log(`   Scores -> ${scores}`);
  });

  console.log("\n--- 3. DETECTED CONFLICTS ---");
  if (conflicts.length === 0) {
    console.log("No conflicting claims found.");
  } else {
    conflicts.forEach((c) => {
      console.log(`• [${c.confidence.toUpperCase()} CONFIDENCE] Category: ${c.category} - ${c.topic}`);
      console.log(`   Explanation: ${c.explanation}`);
      console.log(`   - ${c.sourceA.sourceName}: "${c.sourceA.quote}"`);
      console.log(`   - ${c.sourceB.sourceName}: "${c.sourceB.quote}"`);
    });
  }

  console.log("\n--- 4. OUTDATED / UNDATED WARNINGS ---");
  outdatedWarnings.forEach((w) => {
    console.log(`• [${w.warningType}] Source: ${w.sourceName}`);
    console.log(`   Message: ${w.message}`);
    if (w.quote) console.log(`   Quote: "${w.quote}"`);
  });

  console.log("\n--- 5. PRIORITIZED VERIFY CHECKLIST ---");
  checklist.forEach((item) => {
    console.log(`• [${item.priority.toUpperCase()}] ${item.title}`);
    console.log(`   Action: ${item.action}`);
    console.log(`   Ref: ${item.sourceReference || "N/A"}`);
  });

  console.log("\n==================================================");
  console.log("Models used during execution:");
  allModelsUsed.forEach((m) => {
    console.log(` - ${m.task}: ${m.provider} (${m.model}) [${m.latencyMs}ms]`);
  });
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Pipeline run failed:", err);
  process.exit(1);
});
