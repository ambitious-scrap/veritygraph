# VerityGraph

> **Every claim must earn its evidence.**

An evidence-first verification compiler for research and AI-generated answers. VerityGraph extracts atomic claims, retrieves evidence with Tavily Search and Tavily Extract, verifies each claim with Gemini, and fails unsupported claims with visible proof requirements.

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

## Workflows

- **Research Mode:** Submit a research question (`mode: "research"`, `query`) and run the full search -> extraction -> verification pipeline.
- **Audit Mode:** Paste an AI-generated answer or report (`mode: "audit"`, `text`) and verify only claims that appear in the pasted text.
- **Demo Mode:** Click **Demo** to load deterministic sample data without API calls.

---

## 6-Stage Verification Pipeline

1. **Initial Search:** Tavily Advanced Search gathers query context. Audit Mode skips this stage and uses the pasted answer as source text.
2. **Claim Extraction:** Gemini extracts exactly 3 atomic, factual, check-worthy claims plus support and challenge search queries.
3. **Evidence Search:** Tavily Basic Search retrieves support and challenge candidates for each claim.
4. **Focused Extraction:** Tavily Extract reads up to 4 selected URLs per claim. Search snippets remain as fallback when extraction has no usable text.
5. **Claim Verification:** Gemini evaluates only supplied evidence and returns verdict, confidence, evidence stance, missing evidence, and next-best query.
6. **Report Synthesis:** Gemini compiles a concise summary without introducing new facts.

---

## Verification Build Status

Each claim receives a deterministic build status:

- **PASS:** Supported, confidence >= 70%, and at least 2 independent evidence origins.
- **WARNING:** Partial support, insufficient evidence above 30%, supported-but-underpowered source independence, or supported confidence below 70%.
- **FAIL:** Contradicted, or insufficient evidence with confidence <= 30%.

Overall build status is calculated from claim statuses: any failed claim fails the build; warnings without failures produce a warning build; otherwise the build passes.

---

## Source Independence Heuristic

VerityGraph keeps duplicate sources visible but groups related origins:

- Canonicalizes URLs.
- Normalizes domains and titles.
- Groups near-duplicate titles using token Jaccard similarity >= 0.72.
- Treats same-domain sources as the same origin unless titles are clearly unrelated.
- Displays source count, independent origins, duplicate groups, and origin badges.

---

## Proof-Carrying Report Export

The frontend exports the current run as:

- `veritygraph-proof-report.md`
- `veritygraph-proof-report.json`

Exports include workflow mode, build status, executive summary, run metrics, each claim, confidence factors, source independence, missing evidence, recommended next search, and source URLs.

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
- **Heuristic Source Independence:** Origin grouping is deterministic and visible, but it is not a full academic citation graph.
- **No Replacement for Expert Review:** System outputs assist research workflows and do not replace professional domain expertise.
- **Source Dependency:** Claim verification fidelity depends strictly on web pages retrieved during Tavily search and extract stages.
- **No Persistent Database:** Results are calculated on demand; persistent history storage is not included in this shell.
