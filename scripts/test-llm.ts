import { z } from "zod";
import { callGemini } from "../lib/providers/gemini";
import { callGroq } from "../lib/providers/groq";
import { generateJson } from "../lib/llm";
import * as dotenv from "dotenv";

// Load environment variables from .env.local and .env
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const TestResponseSchema = z.object({
  status: z.string(),
  provider_name: z.string(),
});

async function run() {
  console.log("=== Testing GapSense LLM Providers ===");
  console.log(`Current LLM_PRIMARY: ${process.env.LLM_PRIMARY || "gemini (default)"}`);
  console.log(`FORCE_FAILOVER: ${process.env.FORCE_FAILOVER || "false"}`);

  // Test Direct Gemini
  console.log("\n1. Testing Google Gemini...");
  if (!process.env.GEMINI_API_KEY) {
    console.log("   ❌ GEMINI_API_KEY is not set.");
  } else {
    try {
      const start = Date.now();
      const res = await callGemini({
        prompt: 'Return a JSON object: {"status": "ok", "provider_name": "gemini"}',
      });
      console.log(`   ✅ Gemini succeeded in ${Date.now() - start}ms (model: ${res.model})`);
      console.log(`      Response: ${res.text.trim().substring(0, 100)}`);
    } catch (err: any) {
      console.log(`   ❌ Gemini call failed: [${err.status || "ERR"}] ${err.message}`);
    }
  }

  // Test Direct Groq
  console.log("\n2. Testing Groq (OpenAI-compatible)...");
  if (!process.env.GROQ_API_KEY) {
    console.log("   ❌ GROQ_API_KEY is not set.");
  } else {
    try {
      const start = Date.now();
      const res = await callGroq({
        prompt: 'Return a JSON object: {"status": "ok", "provider_name": "groq"}',
      });
      console.log(`   ✅ Groq succeeded in ${Date.now() - start}ms (model: ${res.model})`);
      console.log(`      Response: ${res.text.trim().substring(0, 100)}`);
    } catch (err: any) {
      console.log(`   ❌ Groq call failed: [${err.status || "ERR"}] ${err.message}`);
    }
  }

  // Test Unified generateJson layer with validation
  console.log("\n3. Testing Unified generateJson() with validation & failover logic...");
  try {
    const res = await generateJson({
      prompt: 'Output ONLY raw JSON: {"status": "success", "provider_name": "unified"}',
      schema: TestResponseSchema,
    });
    console.log(`   ✅ Unified layer succeeded!`);
    console.log(`      Provider: ${res.provider} (${res.model})`);
    console.log(`      Used Fallback: ${res.usedFallback}`);
    console.log(`      Latency: ${res.latencyMs}ms`);
    console.log(`      Data:`, res.data);
  } catch (err: any) {
    console.log(`   ❌ Unified layer failed: ${err.message}`);
  }

  console.log("\n=== Test Finished ===");
}

run().catch(console.error);
