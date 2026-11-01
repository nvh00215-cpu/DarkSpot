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
  console.log("       DarkSpot End-to-End Pipeline Runner        ");
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

  // Step 4: Outdated & Undated Warnings (Run to classify sources)
  console.log("\nStep 4: Checking for outdated / past-cycle warnings (Grouped per source)...");
  const outdatedWarnings = checkOutdatedInformation(verifiedFacts, sources, new Date("2026-11-01"));
  console.log(`   ✓ Evaluated ${outdatedWarnings.length} sources.`);

  // Step 5: Coverage & Gaps (Passing verified extracted facts into coverage evaluation)
  console.log("\nStep 5: Running topic coverage analysis & gap detection...");
  const { coverageMatrix, gaps, callRecords: coverageRecords } = await analyzeCoverage({
    question,
    sources,
    facts: verifiedFacts,
    outdatedWarnings,
  });
  console.log(`   ✓ Generated ${coverageMatrix.topics.length} topics.`);
  console.log(`   ✓ Identified ${gaps.length} potential gaps.`);

  // Step 6: Conflicts
  console.log("\nStep 6: Detecting conflicts across sources (Differentiating cycle differences)...");
  const { conflicts, callRecords: conflictRecords } = await detectConflicts({
    facts: verifiedFacts,
    sources,
    outdatedWarnings,
  });
  console.log(`   ✓ Identified ${conflicts.length} discrepancies (${conflicts.filter(c => c.type === "possible_conflict").length} conflicts, ${conflicts.filter(c => c.type === "cycle_difference").length} cycle differences).`);

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

  // Save to sample analysis.json
  const outPath = path.join(sampleDir, "analysis.json");
  fs.writeFileSync(outPath, JSON.stringify(analysisResult, null, 2), "utf-8");
  console.log(`\nSaved analysis result to: ${outPath}`);

  // Display outputs
  console.log("\n==================================================");
  console.log("            PIPELINE EXECUTION REPORT             ");
  console.log("==================================================");

  console.log("\n--- 1. COVERAGE MATRIX ---");
  coverageMatrix.topics.forEach((t) => {
    const scores = Object.entries(t.sourceScores)
      .map(([sId, sc]) => `${sId}: ${sc}`)
      .join(" | ");
    console.log(`• [STATUS: ${t.status.toUpperCase()}] ${t.topic}`);
    console.log(`   Scores -> ${scores}`);
    if (t.quotes) {
      Object.entries(t.quotes).forEach(([sId, q]) => {
        if (q) console.log(`     ${sId} Quote: "${q}"`);
      });
    }
    if (t.note) console.log(`   Note: ${t.note}`);
  });

  console.log("\n--- 2. DETECTED CONFLICTS & CYCLE DIFFERENCES ---");
  if (conflicts.length === 0) {
    console.log("No conflicting claims found.");
  } else {
    conflicts.forEach((c) => {
      console.log(`• [TYPE: ${c.type.toUpperCase()}] [CONFIDENCE: ${c.confidence.toUpperCase()}] Category: ${c.category} - ${c.topic}`);
      console.log(`   Explanation: ${c.explanation}`);
      console.log(`   - ${c.sourceA.sourceName} (outdated: ${c.sourceA.isOutdated}): "${c.sourceA.quote}"`);
      console.log(`   - ${c.sourceB.sourceName} (outdated: ${c.sourceB.isOutdated}): "${c.sourceB.quote}"`);
    });
  }

  console.log("\n--- 3. OUTDATED / UNDATED WARNINGS ---");
  outdatedWarnings.forEach((w) => {
    console.log(`• [${w.status.toUpperCase()}] Source: ${w.sourceName}`);
    console.log(`   Summary: ${w.summary}`);
    if (w.evidenceList.length > 0) {
      w.evidenceList.forEach((e) => {
        console.log(`    - [${e.evidenceType}] ${e.message} (Quote: "${e.quote || 'N/A'}")`);
      });
    }
  });

  console.log("\n--- 4. PRIORITIZED VERIFY CHECKLIST ---");
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
