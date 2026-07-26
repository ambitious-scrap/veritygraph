# VerityGraph

> **Every claim must earn its evidence.**

An evidence-first multi-agent research system that extracts atomic claims from complex research topics, retrieves real literature via Tavily, and evaluates each claim with Gemini using deterministic support/contradiction verdicts and confidence scoring before compiling a final report.

---

## Required API Keys

Create `.env.local` inside `frontend/` (or set environment variables):

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.6-flash
TAVILY_API_KEY=your_tavily_api_key_here
```

---

## 5-Stage Verification Pipeline

```
┌────────────────────────┐
│ 1. Initial Research    │ Tavily Advanced Search (top 5 sources)
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│ 2. Claim Extraction    │ Gemini 3.6 Flash -> 3 atomic, verifiable claims + search queries
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│ 3. Evidence Search     │ Tavily Basic Search (parallel support & challenge queries)
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│ 4. Claim Verification  │ Gemini parallel claim evaluation + deterministic confidence caps
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│ 5. Report Synthesis    │ Gemini 2-4 sentence executive summary acknowledging contradictions
└────────────────────────┘
```

1. **Initial Research:** Searches Tavily for top 5 relevant web sources.
2. **Claim Extraction:** Uses Gemini to extract exactly 3 atomic, specific, verifiable claims and constructs targeted `supportQuery` and `challengeQuery` search strings.
3. **Evidence Search:** Runs parallel support and challenge Tavily searches for each claim, deduplicating candidate evidence items by canonical URL.
4. **Claim Verification:** Prompts Gemini to evaluate each claim strictly using supplied evidence sources, assigning verdicts (`supported`, `contradicted`, `partial`, `insufficient`), confidence scores, and relevance metrics. Applies deterministic confidence caps based on evidence availability and domain diversity.
5. **Report Synthesis:** Prompts Gemini to generate a balanced 2–4 sentence executive summary highlighting key findings, contradictions, and evidence limits.

---

## Live Research vs. Demo Mode

- **Live Research Mode:** Submits user query to `POST /api/research`, executing the full 5-stage verification pipeline in real time.
- **Demo Mode:** Click **"Load Demo Result"** on the dashboard to view pre-evaluated verification results for coffee consumption and mortality literature without invoking external APIs.

---

## How to Run Locally

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env.local
```
Fill in your `GEMINI_API_KEY` and `TAVILY_API_KEY`.

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build & Lint Verification
```bash
npm run lint
npm run build
```

---

## Current MVP Limitations

- **Source Depth:** Search queries inspect web excerpts; full-text PDF parsing is deferred.
- **Claim Count:** Fixed at exactly 3 atomic claims per research query for hackathon performance bounds.
- **Database & Persistence:** Results are generated dynamically; persistent storage is not enabled in this shell.
