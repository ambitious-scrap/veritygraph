# VerityGraph

> **Every claim must earn its evidence.**

An evidence-first multi-agent research system that extracts atomic claims from complex research topics, retrieves real literature, and evaluates each claim with support/contradiction verdicts and confidence scores before compiling a final report.

## The Problem
LLM research tools synthesize summaries without claim-level evidence grounding, frequently mixing verified facts with hallucinated or contradicted inferences.

## Unique Selling Proposition (USP)
**Claim-level evidence verification.** VerityGraph breaks down research queries into granular claims, attaches specific literature excerpts with relevance scores, and assigns deterministic support, contradiction, partial, or insufficient verdicts.

## Current Architecture
- **Frontend / Application Core:** Next.js 15 (App Router, React 19, TypeScript, Tailwind CSS)
- **API Engine:** Next.js Route Handlers (`/api/health`, `/api/env`)
- **Data Contracts:** Strict TypeScript domain models (`ResearchRun`, `Claim`, `Evidence`, `ClaimVerdict`)

## Local Setup

### Prerequisites
- Node.js 18+
- npm 10+

### Installation & Running

1. Clone repository and navigate to frontend:
   ```bash
   git clone https://github.com/ambitious-scrap/veritygraph.git
   cd veritygraph/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env.local` and supply keys:
   ```bash
   cp .env.example .env.local
   ```

   Required variables:
   - `GEMINI_API_KEY`: API key for Gemini LLM orchestration
   - `TAVILY_API_KEY`: API key for Tavily research search engine

4. Development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. Production Build & Lint:
   ```bash
   npm run lint
   npm run build
   ```
