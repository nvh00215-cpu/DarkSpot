# DarkSpot

**AI-assisted information gap detection platform**

> *Find what your sources don't tell you.*

DarkSpot audits information instead of summarizing it. Give it a research question and a few sources, and it tells you what is missing, what conflicts, and what to verify next, with an exact quote behind every finding.

Live link : https://dark-spot.vercel.app/

---

## 1. Problem

People make important decisions about scholarships, careers, public services and research using information scattered across many websites. Some pages are outdated, different pages contradict each other, and important questions are never answered at all.

Search engines help users find pages, and summarizers condense what those pages say, but neither tells the user **what is missing, what conflicts, or what needs to be checked before acting.**

A student reading three scholarship pages may never notice that:

- renewal conditions appear nowhere,
- two pages list different required documents, or
- one page describes last year's cycle.

## 2. Solution

DarkSpot is a web platform that **audits** information instead of summarizing it.

The user enters a research question and adds sources (public URLs or pasted text). DarkSpot then:

1. extracts structured facts from each source,
2. checks what a complete answer should cover,
3. compares sources against each other,
4. flags outdated or undated material, and
5. produces a prioritized checklist of what to verify next.

Every finding is tied to an exact quote from a source. AI-generated signals are clearly labelled as **potential gaps** or **possible conflicts**, never as guaranteed facts.

## 3. How It Works (Pipeline)

| Step | Stage | Done by | What happens |
|------|-------|---------|--------------|
| 1 | **Ingest** | Jina Reader | URLs are converted to clean text. Users can also paste raw text. If one source fails to load, the others are still analyzed and the failure is shown per source. |
| 2 | **Extract** | LLM | Each source is read and facts are extracted into normalized categories: deadline, eligibility, required documents, application process, renewal conditions, award amount, contact, other. Every fact includes a verbatim quote and any date mentioned. Sources are processed in parallel. |
| 3 | **Verify quotes** | Plain code (no AI) | Each quote is checked against the source text. Facts whose quote cannot be found are marked **unverified** and excluded from conflict analysis. This prevents hallucinated evidence. |
| 4 | **Coverage check** | LLM, grounded by code | The system generates the topics a complete answer should cover, then marks each topic for each source as *covered*, *not found* or *unclear*. A source can be marked "covered" only if a verified fact supports it. Topics not covered by any current source, or covered only by an outdated source, become potential gaps. |
| 5 | **Conflict detection** | LLM | Facts are compared within the same category across sources. Disagreements between current sources are reported as **possible conflicts** with both quotes and a confidence level. Differences involving an outdated source are labelled **cycle differences**, because they usually reflect a change between years and not a contradiction. |
| 6 | **Outdated check** | Plain code | Dates and cycle references are parsed and compared with the real current date. Sources referring to past cycles, dates older than 12 months, or showing no date are flagged, with the evidence quotes listed. |
| 7 | **Checklist** | Plain code | Findings become a prioritized "verify next" list (see below). |

### Checklist priorities

| Priority | Items |
|----------|-------|
| **High** | Conflicts, and missing critical items (deadline, documents, application link, renewal, award amount) |
| **Medium** | Cycle differences and outdated notices |
| **Low** | Other gaps |

A baseline item always asks the user to confirm the deadline, document list and application link on the official source.

## 4. Major Features

- **Research question input** with up to 5 sources (URLs or pasted text)
- **Structured facts** grouped by category, each with its exact quote and source
- **Coverage matrix**: topics by sources, with covered / not found / unclear and an overall status, including "covered only by an outdated source"
- **Conflict view** with side-by-side quotes, confidence badges and a separate label for cycle differences
- **Outdated and undated warnings** grouped per source, with evidence
- **Interactive verification checklist** sorted by priority
- **Summary cards**: verified facts, potential gaps, possible conflicts, cycle differences, outdated sources
- **Evidence side panel**: clicking any finding opens the exact supporting quotes and source references
- **Clear visual separation** between sourced facts, AI-detected signals (with an "AI signal" badge and confidence) and "not found in the sources reviewed"
- **Transparency line** showing which model produced the analysis, including when a backup model was used
- **Sample sources** (clearly labelled fictional) that fill the form but still run the full live pipeline
- **Per-source error and truncation notices**, friendly error banners, and a clearly labelled "saved result from an earlier run, not live" fallback if all AI providers are unavailable

## 5. Uniqueness and Innovation

- **It reports absence and disagreement**, which search and summarization tools do not. The output is what is missing, what conflicts and what to check.
- **Evidence is verified by code, not trusted from the model.** Every quote is matched against the source text, and unverifiable findings are dropped from conflict analysis.
- **Coverage marks are grounded in verified facts**, which reduces the chance of invented coverage.
- **Cycle differences are separated from real contradictions**, reducing false alarms from year-to-year changes.
- **Deterministic code handles dates and priorities**, so results are consistent and explainable. Model temperature is set to 0.
- **Reliability by design:** automatic failover across a second fast model and a second AI provider, a cooldown after quota errors, input limits, rate limiting, and server-side-only API keys.
- **Honest by design:** findings are worded as "potential gap" and "possible conflict", and the interface reminds users that AI signals must be verified with official sources.

## 6. Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, lucide-react icons, Lora and DM Sans fonts, custom warm coffee-toned theme |
| **Backend** | Next.js API routes (Node.js runtime), zod for request and response validation |
| **Source ingestion** | Jina Reader (URL to clean text), plus pasted text |
| **AI layer** | Groq (OpenAI-compatible API, `openai/gpt-oss-120b`) as primary; a second Groq model as in-provider fallback; Google Gemini (`gemini-3.5-flash-lite`) as backup provider. All sit behind one provider-agnostic interface with JSON validation and automatic retry |
| **Plain-code modules** | Quote verification, date analysis, checklist generation, rate limiting |
| **Deployment** | Vercel; source on GitHub |
| **Data** | No database and no login. Analysis runs per request, which keeps the demo open and private |

## 7. Safeguards

- API keys are used **only on the server**.
- Requests are validated: question length, source count, text length, http/https URLs only, private addresses rejected.
- Fetched text is truncated.
- External calls have timeouts.
- A per-IP rate limit protects the quota.

## 8. Getting Started

> Adjust the variable names and commands below to match your actual project.

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd darkspot

# 2. Install dependencies
npm install

# 3. Add your API keys (server-side only)
cp .env.example .env.local
# GROQ_API_KEY=...
# GEMINI_API_KEY=...

# 4. Run locally
npm run dev
```

Then open `http://localhost:3000`, load a sample scenario or enter your own question and sources, and click **Analyze**.

## 9. Future Scope

- **Saved research sessions**, history and shareable reports (accounts and a database)
- **Automatic source discovery** through permitted search APIs, with source-quality and official-domain scoring
- **PDF and document upload** with OCR for scanned notices
- **Multilingual** sources and output
- **Monitoring:** re-check saved sources on a schedule and alert users when a deadline or requirement changes
- **Domain templates** (scholarships, visas, admissions, public schemes, medical guidelines, compliance) with tuned coverage topics
- **Exportable audit reports** (PDF) and a **browser extension** to audit the page the user is reading
- **Evaluation benchmark** with labelled gaps and conflicts to measure precision and recall over time
- **Human-in-the-loop review**, where users confirm or dismiss findings to improve future results

---

*DarkSpot findings are AI-assisted signals. Always confirm deadlines, requirements and links on the official source before acting.*
