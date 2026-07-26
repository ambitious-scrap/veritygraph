# VerityGraph

> **Every claim must earn its evidence.**

An evidence-first multi-agent research system that extracts atomic claims from complex research topics, retrieves real literature via Tavily, and evaluates each claim using Google Gemini SDK with automatic dual-key fallback, deterministic support/contradiction verdicts, and confidence scoring before compiling a final report.

---

## Required API Keys

Create `.env.local` inside `frontend/`:

```env
GEMINI_API_KEY_PRIMARY=your_primary_gemini_api_key
GEMINI_API_KEY_SECONDARY=your_secondary_gemini_api_key
GEMINI_MODEL=gemini-3.6-flash
TAVILY_API_KEY=your_tavily_api_key
```

### Automatic Key Fallback
If the primary Gemini key encounters rate limits (429), quota limits, or server errors, the system automatically retries the operation seamlessly using the secondary key.

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
Fill in `GEMINI_API_KEY_PRIMARY`, `GEMINI_API_KEY_SECONDARY`, and `TAVILY_API_KEY`.

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build & Lint
```bash
npm run lint
npm run build
```
