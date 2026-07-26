# VerityGraph

> **Every claim must earn its evidence.**

An evidence-first multi-agent research system that extracts atomic claims from complex research topics, retrieves literature via Tavily Search, extracts focused source passages via Tavily Extract, and verifies each claim using Google Gemini SDK with strict structured JSON output and automatic dual-key failover.

---

## Required API Keys

Configure environment variables in `.env.local` inside `frontend/`:

```env
GEMINI_API_KEY_PRIMARY=your_primary_gemini_api_key
GEMINI_API_KEY_SECONDARY=your_secondary_gemini_api_key
GEMINI_MODEL=gemini-3.6-flash
TAVILY_API_KEY=your_tavily_api_key
```

---

## 6-Stage Verification Pipeline

```
┌──────────────────────────┐
│ 1. Initial Search        │ Tavily Advanced Search (top 5 sources)
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 2. Claim Extraction      │ Gemini 3.6 Flash -> 3 atomic, unique claims + search queries
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 3. Evidence Search       │ Tavily Basic Search (parallel support & challenge candidate queries)
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 4. Focused Extraction    │ Tavily Extract -> focused page content (max 4 URLs per claim, 15s timeout)
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 5. Claim Verification    │ Gemini parallel claim evaluation + deterministic confidence caps
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 6. Report Synthesis      │ Gemini 2-4 sentence executive summary acknowledging evidence limits
└──────────────────────────┘
```

1. **Initial Search:** Finds top 5 general literature sources for query context.
2. **Claim Extraction:** Gemini extracts 3 atomic, verifiable claims and targeted `supportQuery` and `challengeQuery` search queries.
3. **Evidence Search:** Searches Tavily for candidate supporting and challenging web sources.
4. **Focused Evidence Extraction:** Invokes Tavily Extract on up to 4 selected candidate URLs per claim (max 2 support + 2 challenge, preferring distinct domains) to retrieve query-focused page passages (chunks_per_source: 2, 15s timeout). Search snippets are used seamlessly as fallback if extraction returns no content. Extraction failures never terminate research.
5. **Claim Verification:** Evaluates each claim strictly using supplied passages/snippets, assigning verdicts (`supported`, `contradicted`, `partial`, `insufficient`), stances (`support`, `contradict`, `neutral`), relevance scores, and applying deterministic confidence caps.
6. **Report Synthesis:** Compiles a 2–4 sentence executive summary of overall findings and contradictions.

---

## Live vs. Demo Mode

- **Live Research (`mode: "live"`):** Submits research query to `POST /api/research`, running the full 6-stage verification engine. Displays a "Live Research" badge. If primary key failover occurred, displays a "Secondary Gemini key used" badge.
- **Demo Mode (`mode: "demo"`):** Click **"Load Demo Result"** to instantly inspect pre-evaluated, deterministic claim-verification data with focused-source extracts and search snippet fallbacks for coffee mortality literature without making API calls. Displays a "Demo Data" badge.

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

- **Web Text & Snippet Scrapes:** Tavily Extract retrieves focused HTML/text passages; full PDF document parsing is not implemented.
- **Heuristic Confidence:** Confidence scores reflect structural evidence agreement, domain diversity, evidence basis, and caps—not probability of absolute truth.
- **No Replacement for Expert Review:** System outputs assist research workflows and do not replace professional domain expertise.
- **Source Dependency:** Claim verification fidelity depends strictly on web pages retrieved during Tavily search and extract stages.
- **No Persistent Database:** Results are calculated on demand; persistent history storage is not included in this shell.
