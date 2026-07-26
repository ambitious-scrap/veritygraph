# Verification Engine Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade VerityGraph into a reproducible proof-carrying verification compiler without changing the interface architecture or adding infrastructure.

**Architecture:** Keep the existing Next.js route-handler pipeline. Move deterministic URL, title, source-independence, build-status, and metric logic into `verificationRules.ts`; keep provider I/O in `gemini.ts` and `tavily.ts`; compose trace and manifest data in `research.ts`; expose claim-only re-verification through `/api/reverify`; preserve complete run data for existing client exports.

**Tech Stack:** Next.js App Router, TypeScript, Zod, `@google/genai`, Tavily Search/Extract, Node assertion script.

## Global Constraints

- No branch changes, UI redesign, global visual style changes, UI framework, LangGraph, database, authentication, streaming, PDF parsing, Tavily Research, or test framework.
- Gemini uses `new GoogleGenAI({ apiKey })`, one primary call and at most one secondary call only for retryable provider failures.
- Gemini calls retain a 20-second per-provider timeout and fallback wait is at most 750ms.
- Strict Research and Audit claim schemas each return exactly three claims.
- Build status is deterministic and never model-selected.
- Prompts, keys, raw provider errors, raw model output, request bodies, and environment values never enter public metadata.

## Tasks

### Task 1: Provider and contract foundation

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/gemini.ts`
- Modify: `frontend/src/lib/env.ts`
- Modify: `frontend/.env.example`

Add `searchQueries`, optional `auditAnchor`, `agentTrace`, `manifest`, and `summaryMetadata` to the public run contract. Define agent roles, trace stages, manifest version fields, and source-independence syndicated count. Replace OpenRouter logic with one GoogleGenAI path, retry only categorized retryable failures, and stop after two attempts. Split strict Research/Audit schemas, normalize only after validation, and reject duplicate/paraphrase-like claims and identical query sets. Preserve sanitized `PipelineError` behavior.

### Task 2: Deterministic engine modules

**Files:**
- Create: `frontend/src/lib/quoteAnchoring.ts`
- Create: `frontend/src/lib/verificationRules.ts`
- Modify: `frontend/src/lib/tavily.ts`
- Modify: `frontend/src/lib/research.ts`

Implement quote anchoring with exact, case-insensitive, whitespace-normalized, and unmatched states plus normalized-to-original index mapping. Centralize canonical URL/domain/title/token/Jaccard helpers, source independence, claim/overall build classification, and metrics. Use stable `origin-N` IDs and group syndicated sources without hiding them.

### Task 3: Pipeline integration

**Files:**
- Modify: `frontend/src/lib/research.ts`
- Modify: `frontend/src/lib/gemini.ts`
- Modify: `frontend/src/lib/tavily.ts`
- Modify: `frontend/src/lib/mockData.ts`

Preserve extraction queries on claims, attach audit quotes and anchors, record real stage durations and fallback statuses, calculate final metrics before constructing the manifest, and mark the researcher skipped in Audit Mode. Ensure demo data satisfies the complete `ResearchRun` contract.

### Task 4: API contracts and targeted re-verification

**Files:**
- Modify: `frontend/src/app/api/research/route.ts`
- Create: `frontend/src/app/api/reverify/route.ts`

Use strict discriminated Research/Audit request validation with no provider call on invalid input. Add the no-store, node-runtime `/api/reverify` route that searches only the selected claim’s next-best and challenge queries, merges original support intent, extracts focused evidence, verifies once through the bounded Gemini wrapper, recalculates deterministic independence/build state, and returns claim, trace, provider metadata, and manifest patch.

### Task 5: Complete exports and documentation

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `README.md`

Keep existing export controls and emit complete Markdown/JSON proof-carrying reports, including original input, stale-summary disclosure, trace, manifest, claim queries, audit quote anchors, build state, confidence factors, source independence, evidence basis/stance/origin/URL, and the exact required disclaimer. Add concise engine sections to README without rewriting unrelated content.

### Task 6: Pure assertions and validation

**Files:**
- Create: `frontend/scripts/engine-assertions.ts`

Use Node assertions without a test framework for quote anchoring, source independence, build rules, manifest secrecy/invariants, and query preservation. Run the script, `npm run lint`, `npm run build`, `git diff --check`, and manual API scenarios A–G using configured local keys where available. Record actual durations and failures; do not claim completion without fresh evidence.
