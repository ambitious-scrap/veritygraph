# VerityGraph

> **Every claim must earn its evidence.**

An evidence-first multi-agent research system that extracts atomic claims from complex research topics, retrieves real web literature via Tavily, and verifies each claim using Google Gemini SDK with strict structured JSON output and automatic dual-key failover.

---

## Required API Keys

Configure environment variables in `.env.local` inside `frontend/`:

```env
GEMINI_API_KEY_PRIMARY=your_primary_gemini_api_key
GEMINI_API_KEY_SECONDARY=your_secondary_gemini_api_key
GEMINI_MODEL=gemini-3.6-flash
TAVILY_API_KEY=your_tavily_api_key
```

### Primary & Secondary Gemini Failover Behavior

VerityGraph implements strict, classified dual-key failover to maximize availability:

1. **Primary Key Execution:** Every LLM call initially targets `GEMINI_API_KEY_PRIMARY` with a 20-second timeout.
2. **Fallback Conditions:** Secondary key (`GEMINI_API_KEY_SECONDARY`) is invoked **only** when the primary call fails due to:
   - Rate limiting (HTTP 429 / Quota / Resource Exhausted)
   - Temporary server errors (HTTP 500, 502, 503)
   - Timeout (20 seconds reached)
   - Network or connection failure (`fetch failed`, `ECONNRESET`, `ETIMEDOUT`)
3. **Non-Retryable Failures:** Failures due to HTTP 400, 401, 403, 404, invalid model configuration, empty responses, or Zod schema validation errors fail immediately with a sanitized `PipelineError` and do not waste secondary key quota.

---

## Live vs. Demo Mode

- **Live Research (`mode: "live"`):** Submits research query to `POST /api/research`, running the full 5-stage live verification engine. Displays a "Live Research" badge. If primary key failover occurred, displays a "Secondary Gemini key used" badge.
- **Demo Mode (`mode: "demo"`):** Click **"Load Demo Result"** to instantly inspect pre-evaluated, deterministic claim-verification data for coffee mortality literature without making API calls. Displays a "Demo Data" badge.

---

## 5-Stage Verification Pipeline

```
┌────────────────────────┐
│ 1. Initial Research    │ Tavily Advanced Search (top 5 sources)
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│ 2. Claim Extraction    │ Gemini 3.6 Flash -> 3 atomic, unique claims + search queries
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│ 3. Evidence Search     │ Tavily Basic Search (parallel support & challenge candidate queries)
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│ 4. Claim Verification  │ Gemini parallel claim evaluation + deterministic confidence caps
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│ 5. Report Synthesis    │ Gemini 2-4 sentence executive summary acknowledging evidence limits
└────────────────────────┘
```

---

## Local Setup & Verification

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Build & Lint Validation
```bash
npm run lint
npm run build
```

---

## Current MVP Limitations

- **Search Excerpts as Evidence:** Verification is evaluated against web search snippets rather than full-text PDF parsing.
- **Heuristic Confidence:** Confidence scores reflect structural evidence agreement, domain diversity, and caps—not probability of absolute truth.
- **No Replacement for Expert Review:** System outputs assist research workflows and do not replace professional domain expertise.
- **Source Dependency:** Claim verification fidelity depends strictly on sources retrieved during Tavily search stages.
- **No Persistent Database:** Results are calculated on demand; persistent history storage is not included in this shell.
