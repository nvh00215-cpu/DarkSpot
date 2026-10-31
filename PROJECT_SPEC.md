# PROJECT SPEC: GapSense - AI-Assisted Information Gap Detection Platform

## 1. Overview
GapSense is a web app where a user enters a research question (e.g., "What should I verify before applying for this scholarship?") and adds several sources (URLs or pasted text).
The app analyzes the sources and surfaces:
1. Structured key facts found per source
2. Potential information gaps (topics not covered by any source)
3. Possible conflicts between sources
4. Outdated or undated information warnings
5. A prioritized "verify next" checklist

Every finding links back to an exact quote from a source. AI-generated signals are visually distinct from sourced facts and strictly worded as "potential gap" / "possible conflict", never as guaranteed facts.

---

## 2. Architecture & Tech Stack
- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui patterns
- **Backend:** Next.js API Routes (`/api/analyze`)
- **Ingestion:** Jina Reader API (`https://r.jina.ai/<url>`) & raw text input
- **LLM Layer:**
  - Primary: Google Gemini (`GEMINI_API_KEY`, `GEMINI_MODEL`)
  - Secondary / Backup: Groq OpenAI-compatible API (`GROQ_API_KEY`, `GROQ_MODEL`, default `llama-3.3-70b-versatile`)
  - Configurable primary selection via `LLM_PRIMARY` (defaults to `gemini`)
  - Force failover testing via `FORCE_FAILOVER=true`
- **Validation:** Zod schemas
- **Storage / State:** No database or authentication; state is request/client-driven.

---

## 3. Analysis Pipeline
1. **Ingest (`/lib/ingest.ts`):** Fetches URLs via Jina Reader with 30s timeout and cleans text. Truncates text to 15,000 characters per source. Handles per-source fetch errors gracefully without failing the entire analysis batch.
2. **Extract Facts (`/lib/extract.ts`):** LLM extracts structured facts per source into normalized categories (`deadline`, `eligibility`, `required_documents`, `application_process`, `renewal_conditions`, `fees_or_amount`, `contact`, `other`). Each fact includes `category`, `value`, `exact_quote`, and `date_mentioned`.
3. **Verify Quotes (`/lib/verifyQuotes.ts`):** Deterministic non-LLM step that verifies each `exact_quote` against the source text (whitespace normalization + fuzzy matching). Unverified quotes are marked as unverified and excluded from conflict checks.
4. **Coverage Matrix & Gaps (`/lib/coverage.ts`):** LLM generates 6-10 essential checklist topics for the question. Scores each topic per source (`covered`, `not_found`, `unclear`). Topics not covered by ANY source become "potential gaps".
5. **Conflict Detection (`/lib/conflicts.ts`):** Compares verified facts in the same category across sources. Only flags conflicts when quotes explicitly differ. Returns both quotes, source references, and confidence level (`high`, `medium`, `low`).
6. **Outdated Warnings (`/lib/dates.ts`):** Deterministic parser checking dates in facts and source text. Flags information older than 12 months, past cycle mentions, or undated sources based on current date.
7. **Verify Checklist (`/lib/checklist.ts`):** Deterministic generation of prioritized items:
   - High: Conflicts, missing deadlines, or missing required documents.
   - Medium: Outdated information warnings.
   - Low: Other potential gaps.

---

## 4. LLM Layer & Failover Specification
- **Single Interface:** `generateJson({ system, prompt, schema }) => Promise<{ data, provider, model }>`
- Standard JSON prompt instructions + Zod validation (independent of proprietary provider structured-output quirks).
- Single automatic retry on invalid JSON before triggering failover.
- Failover conditions: HTTP 429, quota exhaustion, 30s timeouts, network errors, 5xx server errors, or invalid JSON after retry.
- Non-failover conditions: HTTP 400 (Bad Request) or 401/403 (Invalid Key) log clear server-side configuration errors instead of masking them.
- Cooldown: 60-second in-memory cooldown for primary provider after quota errors.
- Secondary missing: skips failover and returns structured error.
- Double failure: returns `{ code: "LLM_UNAVAILABLE", message: "..." }`.

---

## 5. Safeguards & Demo Reliability
- **Zero Client-Side Keys:** API keys are never exposed via `NEXT_PUBLIC_` and are isolated strictly within `/lib/llm.ts` and `/lib/providers/`.
- **Input Validation:** Enforced in `/api/analyze` using Zod:
  - `question`: Required, max 500 characters.
  - `sources`: Max 5 sources.
  - `text`: Max 15,000 characters per text source.
  - `url`: Must be valid `http`/`https` scheme; rejects `localhost` and private IP ranges.
- **Source Truncation:** Enforces max 15,000 characters per source with truncation indicator returned to the client.
- **Rate Limiting:** In-memory sliding window IP rate limiter (e.g., 5 analyses per 10 minutes per IP) returning HTTP 429 with retry header.
- **Timeouts:** 30-second timeout guard on external calls.
- **Sample Data & Emergency Fallback:**
  - Real sample files in `/data/sample/`. "Load sample data" in the UI only pre-populates inputs for live processing.
  - Emergency fallback: If both live providers fail, UI offers an explicit banner to view pre-generated static sample analysis (`/data/sample/analysis.json`), clearly labelled as "Saved result from an earlier run, not live."
  - CLI script `npm run generate-sample` updates the static sample analysis via the real pipeline.

---

## 6. Project Structure
```
/app
  ├── /api/analyze/route.ts
  ├── layout.tsx
  └── page.tsx
/components
/lib
  ├── types.ts
  ├── llm.ts
  ├── providers/
  │   ├── gemini.ts
  │   └── groq.ts
  ├── ingest.ts
  ├── extract.ts
  ├── verifyQuotes.ts
  ├── coverage.ts
  ├── conflicts.ts
  ├── dates.ts
  ├── checklist.ts
  └── rateLimit.ts
/data/sample
/scripts
  ├── test-llm.ts
  ├── generate-sample.ts
  └── run-pipeline.ts
PROJECT_SPEC.md
```

---

## 7. Current Status
- **Current Phase:** Phase 1 Complete (Backend, Safeguards, Pipeline, and CLI Runners).
- **Completed in Phase 1:**
  - Designed and typed all shared schemas in `/lib/types.ts` using Zod.
  - Built unified LLM layer in `/lib/llm.ts`, `/lib/providers/groq.ts` (primary), and `/lib/providers/gemini.ts` (backup).
  - Enforced a hard 30-second timeout with AbortController, automatic single-retry on invalid JSON, markdown fence extraction, in-memory cooldown (60s), and seamless failover to secondary provider on any primary failure.
  - Built deterministic modules: `/lib/ingest.ts` (Jina Reader + pasted text + 15k char truncation), `/lib/verifyQuotes.ts` (verbatim & fuzzy quote match), `/lib/dates.ts` (detects dates >12mo old, past cycles, and undated sources), `/lib/checklist.ts` (prioritized High/Medium/Low action items), and `/lib/rateLimit.ts` (in-memory IP rate limiter).
  - Built LLM pipeline modules: `/lib/extract.ts` (facts with verbatim quotes), `/lib/coverage.ts` (dynamic 6-10 topic matrix + gap detection), and `/lib/conflicts.ts` (cross-source contradiction detection with confidence levels).
  - Built `/api/analyze` route with complete Zod validation, IP rate limiting, source truncation, graceful per-source error handling, and structured error responses.
  - Created realistic fictional scholarship test documents in `/data/sample/` (`sourceA.txt`, `sourceB.txt`, `sourceC.txt`).
  - Implemented `scripts/test-llm.ts`, `scripts/run-pipeline.ts`, and `scripts/generate-sample.ts`.
  - Executed end-to-end pipeline run demonstrating live failover from Groq (upon 429 token limits) to Gemini, verifying 25 facts, detecting 4 conflicts, identifying coverage gaps, generating outdated warnings, and compiling the prioritized checklist.
- **Next Steps:**
  - Phase 2: Build the complete Dashboard UI (Question input, Source manager, Live Analysis state, Results tabs with Sourced Facts, Coverage Matrix, Conflicts, Outdated warnings, and Interactive Checklist).
